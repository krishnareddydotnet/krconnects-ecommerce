using DataApi.Data;
using Microsoft.AspNetCore.Mvc;

namespace DataApi.Controllers;

[ApiController]
[Route("health")]
public class HealthController : ControllerBase
{
    private readonly DataDbContext _db;

    public HealthController(DataDbContext db)
    {
        _db = db;
    }

    // GET /health/live
    // Liveness: only checks the app process is running (no database check),
    // so a database outage does NOT cause Kubernetes to restart this pod.
    [HttpGet("live")]
    public IActionResult Live()
    {
        return Ok(new { status = "ok", check = "live" });
    }

    // GET /health/ready
    // Readiness: checks the database connection. If SQL Server is down,
    // returns 503 and Kubernetes stops sending traffic to this pod.
    [HttpGet("ready")]
    public async Task<IActionResult> Ready()
    {
        bool canConnect = await _db.Database.CanConnectAsync();
        if (!canConnect)
        {
            return StatusCode(503, new { status = "unavailable", check = "ready", database = "unreachable" });
        }

        return Ok(new { status = "ok", check = "ready", database = "connected" });
    }
}
