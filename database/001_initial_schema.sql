SET XACT_ABORT ON;
BEGIN TRANSACTION;

CREATE TABLE dbo.CivilopediaEntry (
    EntryId int IDENTITY(1, 1) NOT NULL,
    GameKey nvarchar(200) NOT NULL,
    LanguageCode varchar(20) NOT NULL,
    GameVersion varchar(32) NOT NULL,
    Category nvarchar(100) NOT NULL,
    Title nvarchar(250) NOT NULL,
    CONSTRAINT PK_CivilopediaEntry PRIMARY KEY (EntryId),
    CONSTRAINT UQ_CivilopediaEntry_GameContext UNIQUE (GameKey, LanguageCode, GameVersion)
);

CREATE TABLE dbo.CivilopediaFragment (
    FragmentId int IDENTITY(1, 1) NOT NULL,
    EntryId int NOT NULL,
    Position int NOT NULL,
    Section nvarchar(150) NOT NULL,
    Body nvarchar(max) NOT NULL,
    RequiredContentKey nvarchar(100) NULL,
    RequiredModeKey nvarchar(100) NULL,
    RequiredScenarioKey nvarchar(100) NULL,
    CONSTRAINT PK_CivilopediaFragment PRIMARY KEY (FragmentId),
    CONSTRAINT FK_CivilopediaFragment_Entry FOREIGN KEY (EntryId)
        REFERENCES dbo.CivilopediaEntry (EntryId),
    CONSTRAINT UQ_CivilopediaFragment_EntryPosition UNIQUE (EntryId, Position),
    CONSTRAINT CK_CivilopediaFragment_Position CHECK (Position > 0)
);

CREATE TABLE dbo.CivilopediaSource (
    SourceId int IDENTITY(1, 1) NOT NULL,
    FragmentId int NOT NULL,
    RelativePath nvarchar(512) NOT NULL,
    SourceRecordKey nvarchar(250) NOT NULL,
    CONSTRAINT PK_CivilopediaSource PRIMARY KEY (SourceId),
    CONSTRAINT FK_CivilopediaSource_Fragment FOREIGN KEY (FragmentId)
        REFERENCES dbo.CivilopediaFragment (FragmentId),
    CONSTRAINT CK_CivilopediaSource_RelativePath CHECK (
        RelativePath <> N''
        AND LEFT(RelativePath, 1) <> N'/'
        AND CHARINDEX(N':', RelativePath) = 0
        AND CHARINDEX(NCHAR(92), RelativePath) = 0
        AND CHARINDEX(N'/../', N'/' + RelativePath + N'/') = 0
    )
);

CREATE INDEX IX_CivilopediaSource_FragmentId ON dbo.CivilopediaSource (FragmentId);

COMMIT TRANSACTION;
