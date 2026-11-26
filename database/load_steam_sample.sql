SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_NAME() <> N'CivilizationVI_Rag_Dev'
    THROW 50001, 'The Steam sample must be loaded in the local development database.', 1;

DECLARE @Entries TABLE (
    GameKey nvarchar(200) NOT NULL,
    LanguageCode varchar(20) NOT NULL,
    GameVersion varchar(32) NOT NULL,
    Category nvarchar(100) NOT NULL,
    Title nvarchar(250) NOT NULL,
    Fragments nvarchar(max) NOT NULL,
    PRIMARY KEY (GameKey, LanguageCode, GameVersion)
);

INSERT @Entries (GameKey, LanguageCode, GameVersion, Category, Title, Fragments)
SELECT GameKey, LanguageCode, GameVersion, Category, Title, Fragments
FROM OPENJSON(@Payload) WITH (
    GameKey nvarchar(200) '$.gameKey',
    LanguageCode varchar(20) '$.languageCode',
    GameVersion varchar(32) '$.gameVersion',
    Category nvarchar(100) '$.category',
    Title nvarchar(250) '$.title',
    Fragments nvarchar(max) '$.fragments' AS JSON
);

BEGIN TRANSACTION;

DECLARE @LockStatus int;
EXEC @LockStatus = sys.sp_getapplock
    @Resource = N'Civilopedia:SteamSample', @LockMode = 'Exclusive',
    @LockOwner = 'Transaction', @LockTimeout = 15000;
IF @LockStatus < 0 THROW 50002, 'Could not acquire the Steam sample import lock.', 1;

MERGE dbo.CivilopediaEntry AS target
USING @Entries AS batch
ON target.GameKey = batch.GameKey
AND target.LanguageCode = batch.LanguageCode
AND target.GameVersion = batch.GameVersion
WHEN MATCHED AND (target.Category <> batch.Category OR target.Title <> batch.Title)
    THEN UPDATE SET Category = batch.Category, Title = batch.Title
WHEN NOT MATCHED BY TARGET
    THEN INSERT (GameKey, LanguageCode, GameVersion, Category, Title)
         VALUES (batch.GameKey, batch.LanguageCode, batch.GameVersion, batch.Category, batch.Title);

DECLARE @Fragments TABLE (
    EntryId int NOT NULL,
    Position int NOT NULL,
    Section nvarchar(150) NOT NULL,
    Body nvarchar(max) NOT NULL,
    RequiredContentKey nvarchar(100) NULL,
    RequiredModeKey nvarchar(100) NULL,
    RequiredScenarioKey nvarchar(100) NULL,
    Sources nvarchar(max) NOT NULL,
    PRIMARY KEY (EntryId, Position)
);

INSERT @Fragments
SELECT entry.EntryId, fragment.*
FROM @Entries AS batch
JOIN dbo.CivilopediaEntry AS entry ON entry.GameKey = batch.GameKey
    AND entry.LanguageCode = batch.LanguageCode AND entry.GameVersion = batch.GameVersion
CROSS APPLY OPENJSON(batch.Fragments) WITH (
    Position int '$.position',
    Section nvarchar(150) '$.section',
    Body nvarchar(max) '$.body',
    RequiredContentKey nvarchar(100) '$.requiredContentKey',
    RequiredModeKey nvarchar(100) '$.requiredModeKey',
    RequiredScenarioKey nvarchar(100) '$.requiredScenarioKey',
    Sources nvarchar(max) '$.sources' AS JSON
) AS fragment;

MERGE dbo.CivilopediaFragment AS target
USING @Fragments AS batch
ON target.EntryId = batch.EntryId AND target.Position = batch.Position
WHEN MATCHED AND EXISTS (
    SELECT target.Section, target.Body, target.RequiredContentKey, target.RequiredModeKey, target.RequiredScenarioKey
    EXCEPT
    SELECT batch.Section, batch.Body, batch.RequiredContentKey, batch.RequiredModeKey, batch.RequiredScenarioKey
) THEN UPDATE SET Section = batch.Section, Body = batch.Body,
    RequiredContentKey = batch.RequiredContentKey, RequiredModeKey = batch.RequiredModeKey,
    RequiredScenarioKey = batch.RequiredScenarioKey
WHEN NOT MATCHED BY TARGET
    THEN INSERT (EntryId, Position, Section, Body, RequiredContentKey, RequiredModeKey, RequiredScenarioKey)
         VALUES (batch.EntryId, batch.Position, batch.Section, batch.Body,
                 batch.RequiredContentKey, batch.RequiredModeKey, batch.RequiredScenarioKey);

DECLARE @Sources TABLE (
    FragmentId int NOT NULL,
    RelativePath nvarchar(512) NOT NULL,
    SourceRecordKey nvarchar(250) NOT NULL
);

INSERT @Sources
SELECT DISTINCT fragment.FragmentId, source.RelativePath, source.SourceRecordKey
FROM @Fragments AS batch
JOIN dbo.CivilopediaFragment AS fragment ON fragment.EntryId = batch.EntryId AND fragment.Position = batch.Position
CROSS APPLY OPENJSON(batch.Sources) WITH (
    RelativePath nvarchar(512) '$.relativePath',
    SourceRecordKey nvarchar(250) '$.sourceRecordKey'
) AS source;

-- Limit cleanup to entries in the incoming batch.
DELETE source
FROM dbo.CivilopediaSource AS source
JOIN dbo.CivilopediaFragment AS fragment ON fragment.FragmentId = source.FragmentId
JOIN dbo.CivilopediaEntry AS entry ON entry.EntryId = fragment.EntryId
JOIN @Entries AS batch ON batch.GameKey = entry.GameKey
    AND batch.LanguageCode = entry.LanguageCode AND batch.GameVersion = entry.GameVersion
WHERE NOT EXISTS (
    SELECT 1 FROM @Sources AS desired WHERE desired.FragmentId = source.FragmentId
      AND desired.RelativePath = source.RelativePath AND desired.SourceRecordKey = source.SourceRecordKey
);

DELETE fragment
FROM dbo.CivilopediaFragment AS fragment
JOIN dbo.CivilopediaEntry AS entry ON entry.EntryId = fragment.EntryId
JOIN @Entries AS batch ON batch.GameKey = entry.GameKey
    AND batch.LanguageCode = entry.LanguageCode AND batch.GameVersion = entry.GameVersion
WHERE NOT EXISTS (
    SELECT 1 FROM @Fragments AS desired
    WHERE desired.EntryId = fragment.EntryId AND desired.Position = fragment.Position
);

INSERT dbo.CivilopediaSource (FragmentId, RelativePath, SourceRecordKey)
SELECT FragmentId, RelativePath, SourceRecordKey FROM @Sources AS desired
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.CivilopediaSource AS source WHERE source.FragmentId = desired.FragmentId
      AND source.RelativePath = desired.RelativePath AND source.SourceRecordKey = desired.SourceRecordKey
);

COMMIT TRANSACTION;
