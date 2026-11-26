IF ISNULL(FULLTEXTSERVICEPROPERTY('IsFullTextInstalled'), 0) <> 1
    THROW 50030, 'Install SQL Server Full-Text Search before running this migration.', 1;
GO

IF NOT EXISTS (SELECT 1 FROM sys.fulltext_catalogs WHERE name = N'CivilopediaText')
    CREATE FULLTEXT CATALOG CivilopediaText WITH ACCENT_SENSITIVITY = OFF;
GO

IF NOT EXISTS (SELECT 1 FROM sys.fulltext_indexes WHERE object_id = OBJECT_ID(N'dbo.CivilopediaEntry'))
    CREATE FULLTEXT INDEX ON dbo.CivilopediaEntry (Title LANGUAGE 3082)
        KEY INDEX PK_CivilopediaEntry ON CivilopediaText
        WITH (CHANGE_TRACKING = AUTO, STOPLIST = SYSTEM);
GO

IF NOT EXISTS (SELECT 1 FROM sys.fulltext_indexes WHERE object_id = OBJECT_ID(N'dbo.CivilopediaFragment'))
    CREATE FULLTEXT INDEX ON dbo.CivilopediaFragment (Section LANGUAGE 3082, Body LANGUAGE 3082)
        KEY INDEX PK_CivilopediaFragment ON CivilopediaText
        WITH (CHANGE_TRACKING = AUTO, STOPLIST = SYSTEM);
GO

CREATE OR ALTER PROCEDURE dbo.SearchCivilopedia
    @Question nvarchar(4000),
    @Limit int = 5
AS
BEGIN
    SET NOCOUNT ON;

    IF NULLIF(TRIM(@Question), N'') IS NULL
        THROW 50031, 'A search question is required.', 1;
    IF @Limit IS NULL OR @Limit NOT BETWEEN 1 AND 20
        THROW 50032, 'The search result limit must be between 1 and 20.', 1;

    SELECT TOP (@Limit)
        entry.GameKey,
        entry.Title,
        entry.GameVersion,
        fragment.Section,
        fragment.Body,
        fragment.RequiredContentKey,
        fragment.RequiredModeKey,
        fragment.RequiredScenarioKey,
        (
            SELECT source.RelativePath AS relativePath, source.SourceRecordKey AS sourceRecordKey
            FROM dbo.CivilopediaSource AS source
            WHERE source.FragmentId = fragment.FragmentId
            ORDER BY source.SourceId
            FOR JSON PATH
        ) AS Sources
    FROM dbo.CivilopediaFragment AS fragment
    JOIN dbo.CivilopediaEntry AS entry ON entry.EntryId = fragment.EntryId
    LEFT JOIN FREETEXTTABLE(dbo.CivilopediaEntry, Title, @Question, LANGUAGE 3082) AS titleMatch
        ON titleMatch.[KEY] = entry.EntryId
    LEFT JOIN FREETEXTTABLE(dbo.CivilopediaFragment, (Section, Body), @Question, LANGUAGE 3082) AS textMatch
        ON textMatch.[KEY] = fragment.FragmentId
    WHERE entry.LanguageCode = 'es_ES'
      AND (titleMatch.[KEY] IS NOT NULL OR textMatch.[KEY] IS NOT NULL)
    ORDER BY CASE
        WHEN titleMatch.[KEY] IS NOT NULL AND textMatch.[KEY] IS NOT NULL THEN 0
        WHEN textMatch.[KEY] IS NOT NULL THEN 1
        ELSE 2
    END, textMatch.[RANK] DESC, titleMatch.[RANK] DESC, fragment.FragmentId;
END;
GO
