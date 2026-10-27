using AuthApi.Services;
using Microsoft.AspNetCore.Mvc;

namespace AuthApi.Controllers;

[ApiController]
[Route("hello")]
public class HelloController : ControllerBase
{
    private readonly IAuthInfoService _authInfoService;

    public HelloController(IAuthInfoService authInfoService)
    {
        _authInfoService = authInfoService;
    }

    // GET /hello
    [HttpGet]
    public IActionResult Get()
    {
        var response = _authInfoService.GetHello();
        return Ok(response);
    }
}
