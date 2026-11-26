SET NOCOUNT ON;

DECLARE @Results TABLE (
    GameKey nvarchar(200),
    Title nvarchar(250),
    GameVersion varchar(32),
    Section nvarchar(150),
    Body nvarchar(max),
    RequiredContentKey nvarchar(100),
    RequiredModeKey nvarchar(100),
    RequiredScenarioKey nvarchar(100),
    Sources nvarchar(max)
);

DECLARE @Versions TABLE (Ordinal int PRIMARY KEY, GameVersion varchar(32) NOT NULL);
INSERT @Versions VALUES (1, 'RULESET_STANDARD'), (2, 'RULESET_EXPANSION_1'), (3, 'RULESET_EXPANSION_2');

DECLARE @Ordinal int = 1;
DECLARE @GameVersion varchar(32);
WHILE @Ordinal <= 3
BEGIN
    SELECT @GameVersion = GameVersion FROM @Versions WHERE Ordinal = @Ordinal;
    DELETE FROM @Results;

    INSERT @Results
    EXEC dbo.SearchCivilopedia
        @Question = N'Que bonificacion por adyacencia da la selva tropical al Campus?',
        @Limit = 5,
        @GameVersion = @GameVersion;

    IF EXISTS (SELECT 1 FROM @Results WHERE GameVersion <> @GameVersion OR GameVersion IS NULL)
        THROW 50023, 'Search returned evidence from a different game version.', 1;

    IF NOT EXISTS (
        SELECT 1
        FROM @Results AS result
        CROSS APPLY OPENJSON(result.Sources) WITH (
            RelativePath nvarchar(512) '$.relativePath',
            SourceRecordKey nvarchar(250) '$.sourceRecordKey'
        ) AS source
        WHERE result.GameKey = N'DISTRICT_CAMPUS'
          AND result.Title = N'Campus'
          AND result.Body LIKE N'%Selva tropical%'
          AND source.RelativePath = N'Base/Assets/Gameplay/Data/Districts.xml'
          AND source.SourceRecordKey = N'Jungle_Science'
    )
        THROW 50024, 'The selected version must return the Campus jungle adjacency and its source.', 1;

    SET @Ordinal += 1;
END;

BEGIN TRY
    EXEC dbo.SearchCivilopedia @Question = N'Campus', @GameVersion = 'UNSUPPORTED';
    THROW 50025, 'An unsupported version must be rejected.', 1;
END TRY
BEGIN CATCH
    IF ERROR_NUMBER() <> 50033 THROW;
END CATCH;

SELECT 'Game version search acceptance test passed.' AS Result;
