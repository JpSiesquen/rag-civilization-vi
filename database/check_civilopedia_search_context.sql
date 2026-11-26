SET NOCOUNT ON;

DECLARE @Results TABLE (
    GameKey nvarchar(200), Title nvarchar(250), GameVersion varchar(32),
    Section nvarchar(150), Body nvarchar(max), RequiredContentKey nvarchar(100),
    RequiredModeKey nvarchar(100), RequiredScenarioKey nvarchar(100), Sources nvarchar(max)
);
DECLARE @CampusQuestion nvarchar(4000) = N'Cuanta ciencia da una linea ley junto al Campus?';

INSERT @Results
EXEC dbo.SearchCivilopedia @Question = @CampusQuestion, @GameVersion = 'RULESET_EXPANSION_2';
IF NOT EXISTS (SELECT 1 FROM @Results WHERE GameKey = N'DISTRICT_CAMPUS')
    THROW 50041, 'A general Campus search must retain ordinary evidence.', 1;
IF EXISTS (
    SELECT 1 FROM @Results
    WHERE RequiredContentKey IS NOT NULL OR RequiredModeKey IS NOT NULL OR RequiredScenarioKey IS NOT NULL
)
    THROW 50042, 'A general search must exclude conditional evidence.', 1;

DELETE FROM @Results;
INSERT @Results
EXEC dbo.SearchCivilopedia @Question = @CampusQuestion, @GameVersion = 'RULESET_EXPANSION_2',
    @ModeKeys = N'["GAMEMODE_SECRETSOCIETIES"]';
IF EXISTS (SELECT 1 FROM @Results WHERE RequiredContentKey IS NOT NULL)
    THROW 50043, 'A mode does not satisfy the required content pack on its own.', 1;

DELETE FROM @Results;
INSERT @Results
EXEC dbo.SearchCivilopedia @Question = @CampusQuestion, @GameVersion = 'RULESET_EXPANSION_2',
    @ModeKeys = N'["GAMEMODE_SECRETSOCIETIES"]', @ContentKeys = N'["Ethiopia"]';
IF NOT EXISTS (
    SELECT 1 FROM @Results AS result
    CROSS APPLY OPENJSON(result.Sources) WITH (SourceRecordKey nvarchar(250) '$.sourceRecordKey') AS source
    WHERE result.GameKey = N'DISTRICT_CAMPUS' AND result.RequiredModeKey = N'GAMEMODE_SECRETSOCIETIES'
      AND result.RequiredContentKey = N'Ethiopia' AND source.SourceRecordKey = N'LeyLine_Science'
)
    THROW 50044, 'Explicit mode and pack must recover the conditional Ley Line source.', 1;

-- Use a synthetic entry until the complete scenario corpus is loaded.
IF DB_NAME() <> N'CivilizationVI_Rag_Dev'
    THROW 50045, 'Run this check only in the local development database.', 1;
DECLARE @FixtureKey nvarchar(200) = N'TEST_VIKING_' + CONVERT(nvarchar(36), NEWID());
DECLARE @Scenario nvarchar(100) = N'RULESET_SCENARIO_VIKINGS';
DECLARE @EntryId int;
DECLARE @FragmentId int;

BEGIN TRY
    INSERT dbo.CivilopediaEntry (GameKey, LanguageCode, GameVersion, Category, Title)
    VALUES (@FixtureKey, 'es_ES', @Scenario, N'Prueba', N'Sondavikinga');
    SET @EntryId = CONVERT(int, SCOPE_IDENTITY());
    INSERT dbo.CivilopediaFragment (EntryId, Position, Section, Body, RequiredContentKey, RequiredScenarioKey)
    VALUES (@EntryId, 1, N'Prueba', N'Sondavikinga', N'VikingsScenario', @Scenario);
    SET @FragmentId = CONVERT(int, SCOPE_IDENTITY());
    INSERT dbo.CivilopediaSource (FragmentId, RelativePath, SourceRecordKey)
    VALUES (@FragmentId, N'fixtures/Scenario.xml', N'TEST_VIKING_SOURCE');

    DECLARE @Deadline datetime2 = DATEADD(second, 30, SYSUTCDATETIME());
    WHILE NOT EXISTS (
        SELECT 1 FROM FREETEXTTABLE(dbo.CivilopediaFragment, Body, N'Sondavikinga', LANGUAGE 3082)
        WHERE [KEY] = @FragmentId
    )
    BEGIN
        IF SYSUTCDATETIME() >= @Deadline THROW 50046, 'Full-text indexing did not pick up the scenario fixture.', 1;
        WAITFOR DELAY '00:00:01';
    END;

    DELETE FROM @Results;
    INSERT @Results
    EXEC dbo.SearchCivilopedia @Question = N'Sondavikinga', @ContentKeys = N'["VikingsScenario"]';
    IF EXISTS (SELECT 1 FROM @Results WHERE GameKey = @FixtureKey)
        THROW 50047, 'A scenario must be requested explicitly even when the pack is available.', 1;

    DELETE FROM @Results;
    INSERT @Results
    EXEC dbo.SearchCivilopedia @Question = N'Sondavikinga', @GameVersion = 'RULESET_STANDARD',
        @ScenarioKey = @Scenario, @ContentKeys = N'["VikingsScenario"]';
    IF NOT EXISTS (
        SELECT 1 FROM @Results AS result
        CROSS APPLY OPENJSON(result.Sources) WITH (SourceRecordKey nvarchar(250) '$.sourceRecordKey') AS source
        WHERE result.GameKey = @FixtureKey AND result.RequiredScenarioKey = @Scenario
          AND source.SourceRecordKey = N'TEST_VIKING_SOURCE'
    )
        THROW 50048, 'A scenario query must return the scenario fixture and its source.', 1;
END TRY
BEGIN CATCH
    DELETE FROM dbo.CivilopediaSource WHERE FragmentId = @FragmentId;
    DELETE FROM dbo.CivilopediaFragment WHERE FragmentId = @FragmentId;
    DELETE FROM dbo.CivilopediaEntry WHERE EntryId = @EntryId;
    THROW;
END CATCH;

DELETE FROM dbo.CivilopediaSource WHERE FragmentId = @FragmentId;
DELETE FROM dbo.CivilopediaFragment WHERE FragmentId = @FragmentId;
DELETE FROM dbo.CivilopediaEntry WHERE EntryId = @EntryId;

SELECT 'Context search acceptance test passed.' AS Result;
