CREATE OR ALTER PROCEDURE dbo.SearchCivilopedia
    @Question nvarchar(4000),
    @Limit int = 5,
    @GameVersion varchar(32) = NULL,
    @ModeKeys nvarchar(max) = N'[]',
    @ScenarioKey nvarchar(100) = NULL,
    @ContentKeys nvarchar(max) = N'[]'
AS
BEGIN
    SET NOCOUNT ON;

    IF NULLIF(TRIM(@Question), N'') IS NULL
        THROW 50031, 'A search question is required.', 1;
    IF @Limit IS NULL OR @Limit NOT BETWEEN 1 AND 20
        THROW 50032, 'The search result limit must be between 1 and 20.', 1;

    IF @GameVersion IS NOT NULL
       AND @GameVersion NOT IN ('RULESET_STANDARD', 'RULESET_EXPANSION_1', 'RULESET_EXPANSION_2')
        THROW 50033, 'Unsupported Civilization VI game version.', 1;

    IF ISNULL(ISJSON(@ModeKeys, ARRAY), 0) <> 1 OR ISNULL(ISJSON(@ContentKeys, ARRAY), 0) <> 1
        THROW 50034, 'Mode and content keys must be JSON arrays.', 1;

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
      AND (
          (@ScenarioKey IS NULL AND fragment.RequiredScenarioKey IS NULL
              AND (@GameVersion IS NULL OR entry.GameVersion = @GameVersion))
          OR
          (@ScenarioKey IS NOT NULL AND fragment.RequiredScenarioKey = @ScenarioKey
              AND (entry.GameVersion = @ScenarioKey OR @GameVersion IS NULL OR entry.GameVersion = @GameVersion))
      )
      AND (fragment.RequiredModeKey IS NULL OR EXISTS (
          SELECT 1 FROM OPENJSON(@ModeKeys) AS mode
          WHERE mode.[type] = 1 AND mode.[value] = fragment.RequiredModeKey
      ))
      AND (fragment.RequiredContentKey IS NULL OR EXISTS (
          SELECT 1 FROM OPENJSON(@ContentKeys) AS content
          WHERE content.[type] = 1 AND content.[value] = fragment.RequiredContentKey
      ))
      AND (titleMatch.[KEY] IS NOT NULL OR textMatch.[KEY] IS NOT NULL)
    ORDER BY CASE
        WHEN titleMatch.[KEY] IS NOT NULL AND textMatch.[KEY] IS NOT NULL THEN 0
        WHEN textMatch.[KEY] IS NOT NULL THEN 1
        ELSE 2
    END, textMatch.[RANK] DESC, titleMatch.[RANK] DESC, fragment.FragmentId;
END;
GO
