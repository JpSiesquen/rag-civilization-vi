using Microsoft.AspNetCore.Diagnostics.HealthChecks;

var builder = WebApplication.CreateBuilder(args);

var healthChecks = builder.Services.AddHealthChecks();
const string databaseCheckName = "civilopedia-database";

if (builder.Environment.IsDevelopment())
{
    healthChecks.AddCheck<CivilopediaDatabaseHealthCheck>(
        databaseCheckName,
        timeout: TimeSpan.FromSeconds(5));
}

var app = builder.Build();

app.MapHealthChecks("/health", new HealthCheckOptions { Predicate = _ => false });

if (app.Environment.IsDevelopment())
{
    app.MapHealthChecks("/health/database", new HealthCheckOptions
    {
        Predicate = check => check.Name == databaseCheckName
    });
}

app.Run();
