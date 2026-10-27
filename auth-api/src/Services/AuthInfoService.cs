using AuthApi.Models;

namespace AuthApi.Services;

/// <summary>
/// Contains the response-building logic for Auth API's identity and
/// health endpoints. Kept separate from the controller so the controller
/// stays a thin HTTP layer, consistent with KRConnects' Bal-not-Dal-style
/// separation of concerns.
/// </summary>
public class AuthInfoService : IAuthInfoService
{
    private const string ServiceName = "krconnects-auth-api";

    // Simulated dependency check. In production this would verify
    // Azure SQL connectivity (or Key Vault reachability) instead.
    private readonly bool _simulatedDependencyHealthy = true;

    public HelloResponse GetHello()
    {
        return new HelloResponse
        {
            Message = "This is the KRConnects Auth API — responsible for authentication and identity management.",
            Service = ServiceName,
            Timestamp = DateTime.UtcNow.ToString("o")
        };
    }

    public HealthResponse GetLiveness()
    {
        return new HealthResponse
        {
            Status = "ok",
            Service = ServiceName,
            Probe = "liveness",
            Timestamp = DateTime.UtcNow.ToString("o")
        };
    }

    public HealthResponse GetReadiness()
    {
        return new HealthResponse
        {
            Status = _simulatedDependencyHealthy ? "ok" : "unavailable",
            Service = ServiceName,
            Probe = "readiness",
            Dependencies = new { azureSql = _simulatedDependencyHealthy ? "simulated-ok" : "simulated-unreachable" },
            Timestamp = DateTime.UtcNow.ToString("o")
        };
    }

    public HealthResponse GetStartup()
    {
        return new HealthResponse
        {
            Status = "ok",
            Service = ServiceName,
            Probe = "startup",
            Timestamp = DateTime.UtcNow.ToString("o")
        };
    }
}
