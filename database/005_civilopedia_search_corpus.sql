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

    DECLARE @TitleMatches TABLE (MatchId int NOT NULL PRIMARY KEY, Score int NOT NULL);
    DECLARE @TextMatches TABLE (MatchId int NOT NULL PRIMARY KEY, Score int NOT NULL);

    INSERT @TitleMatches
    SELECT [KEY], [RANK] FROM FREETEXTTABLE(dbo.CivilopediaEntry, Title, @Question, LANGUAGE 3082)
    OPTION (MAXDOP 1);

    INSERT @TextMatches
    SELECT [KEY], [RANK] FROM FREETEXTTABLE(dbo.CivilopediaFragment, (Section, Body), @Question, LANGUAGE 3082)
    OPTION (MAXDOP 1);

    DECLARE @Separators nvarchar(30) = N'¿?¡!.,;:()[]{}"' + NCHAR(9) + NCHAR(10) + NCHAR(13);
    DECLARE @Spaces nvarchar(30) = REPLICATE(N' ', LEN(@Separators));
    DECLARE @TitleQuestion nvarchar(max) = N' ' + TRANSLATE(CONVERT(nvarchar(max), @Question), @Separators, @Spaces) + N' ';

    DECLARE @TopFragments TABLE (
        FragmentId int NOT NULL PRIMARY KEY, MatchGroup int NOT NULL, TextScore int NULL, TitleScore int NULL
    );

    -- Rank keys and scores first. Fetch text and sources only for the selected fragments.
    INSERT @TopFragments (FragmentId, MatchGroup, TextScore, TitleScore)
    SELECT TOP (@Limit)
        fragment.FragmentId,
        CASE
            WHEN named.TitleMentioned = 1 AND textMatch.MatchId IS NOT NULL THEN 0
            WHEN named.TitleMentioned = 1 THEN 1
            WHEN titleMatch.MatchId IS NOT NULL AND textMatch.MatchId IS NOT NULL THEN 2
            WHEN textMatch.MatchId IS NOT NULL THEN 3
            ELSE 4
        END AS MatchGroup,
        textMatch.Score AS TextScore,
        titleMatch.Score AS TitleScore
    FROM dbo.CivilopediaFragment AS fragment
    JOIN dbo.CivilopediaEntry AS entry ON entry.EntryId = fragment.EntryId
    LEFT JOIN @TitleMatches AS titleMatch ON titleMatch.MatchId = entry.EntryId
    LEFT JOIN @TextMatches AS textMatch ON textMatch.MatchId = fragment.FragmentId
    CROSS APPLY (SELECT CASE WHEN CHARINDEX(
        N' ' + TRANSLATE(entry.Title, @Separators, @Spaces) + N' ',
        @TitleQuestion COLLATE Latin1_General_100_CI_AI
    ) > 0 THEN 1 ELSE 0 END AS TitleMentioned) AS named
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
      AND (titleMatch.MatchId IS NOT NULL OR textMatch.MatchId IS NOT NULL)
    ORDER BY MatchGroup, TextScore DESC, TitleScore DESC, fragment.FragmentId
    OPTION (MAXDOP 1);

    SELECT
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
    FROM @TopFragments AS ranked
    JOIN dbo.CivilopediaFragment AS fragment ON fragment.FragmentId = ranked.FragmentId
    JOIN dbo.CivilopediaEntry AS entry ON entry.EntryId = fragment.EntryId
    ORDER BY ranked.MatchGroup, ranked.TextScore DESC, ranked.TitleScore DESC, ranked.FragmentId;
END;
GO
