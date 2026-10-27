using AuthApi.Services;
using Microsoft.AspNetCore.Mvc;

namespace AuthApi.Controllers;

[ApiController]
[Route("health")]
public class HealthController : ControllerBase
{
    private readonly IAuthInfoService _authInfoService;

    public HealthController(IAuthInfoService authInfoService)
    {
        _authInfoService = authInfoService;
    }

    // GET /health/live
    // Liveness probe: lightweight, just confirms the process is running.
    // Kept fast — no dependency checks — since Kubernetes calls this
    // repeatedly for the entire lifetime of the pod.
    [HttpGet("live")]
    public IActionResult Live()
    {
        var response = _authInfoService.GetLiveness();
        return Ok(response);
    }

    // GET /health/ready
    // Readiness probe: would check real dependencies (Azure SQL, Key Vault)
    // in production. Here it checks a simulated dependency flag instead.
    // Separated from liveness so a temporary dependency blip only pauses
    // traffic instead of triggering an unnecessary pod restart.
    [HttpGet("ready")]
    public IActionResult Ready()
    {
        var response = _authInfoService.GetReadiness();

        if (response.Status != "ok")
        {
            return StatusCode(503, response);
        }

        return Ok(response);
    }

    // GET /health/startup
    // Startup probe: confirms initial startup work has completed.
    // Gives slower-starting services time to initialize before
    // liveness/readiness checks begin evaluating them.
    [HttpGet("startup")]
    public IActionResult Startup()
    {
        var response = _authInfoService.GetStartup();
        return Ok(response);
    }
}
