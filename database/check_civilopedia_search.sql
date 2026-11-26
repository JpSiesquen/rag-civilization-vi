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

INSERT @Results
EXEC dbo.SearchCivilopedia
    @Question = N'Cuanta ciencia da un arrecife adyacente al Campus?',
    @Limit = 3;

IF NOT EXISTS (
    SELECT 1
    FROM @Results AS result
    CROSS APPLY OPENJSON(result.Sources) WITH (
        RelativePath nvarchar(512) '$.relativePath',
        SourceRecordKey nvarchar(250) '$.sourceRecordKey'
    ) AS source
    WHERE result.GameKey = N'DISTRICT_CAMPUS'
      AND result.Title = N'Campus'
      AND result.GameVersion = 'RULESET_EXPANSION_2'
      AND result.Body LIKE N'%+2 de Ciencia%Arrecife%'
      AND source.RelativePath = N'DLC/Expansion2/Data/Expansion2_Districts.xml'
      AND source.SourceRecordKey = N'Reef_Science'
)
    THROW 50020, 'Campus reef adjacency and its source must appear in the top three results.', 1;

DELETE FROM @Results;
INSERT @Results
EXEC dbo.SearchCivilopedia @Question = N'zzq9981orion', @Limit = 3;

IF EXISTS (SELECT 1 FROM @Results)
    THROW 50021, 'A search without matching evidence must return no results.', 1;

SELECT 'Full-text retrieval acceptance test passed.' AS Result;
