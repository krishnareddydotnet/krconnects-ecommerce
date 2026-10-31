using System.Net;
using System.Net.Http.Json;
using AuthApi.Models;
using AuthApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AuthApi.Controllers;

/// <summary>
/// Sign up, log in, and "who am I".
///   POST /auth/signup   { username }            -> 201 { username, userKey }  | 409 already exists
///   POST /auth/login    { username, userKey }   -> 200 { token, username, expiresAt } | 401
///   GET  /auth/me       (Authorization: Bearer <token>) -> 200 { id, username, role } | 401
///
/// Browser calls /api/auth/...  ->  nginx forwards to http://auth-api:8080/auth/...
/// </summary>
[ApiController]
[Route("auth")]
public class AuthController : ControllerBase
{
    private readonly DataApiClient _dataApi;
    private readonly JwtTokenService _jwt;
    private readonly AdminRoleService _roles;
    private readonly ILogger<AuthController> _logger;

    public AuthController(DataApiClient dataApi, JwtTokenService jwt, AdminRoleService roles, ILogger<AuthController> logger)
    {
        _dataApi = dataApi;
        _jwt = jwt;
        _roles = roles;
        _logger = logger;
    }

    [HttpPost("signup")]
    public async Task<IActionResult> Signup(SignupRequest request)
    {
        string username = request.Username.Trim();

        HttpResponseMessage response;
        try
        {
            // Data API saves the user in the database (only if the username does not exist)
            response = await _dataApi.CreateUserAsync(username);
        }
        catch (Exception ex) when (ex is HttpRequestException || ex is TaskCanceledException)
        {
            _logger.LogError(ex, "Data API unreachable during signup");
            return ServiceUnavailable();
        }

        if (response.StatusCode == HttpStatusCode.Conflict)
        {
            return Conflict(new { message = "That username is already taken." });            // 409
        }

        if (response.StatusCode == HttpStatusCode.BadRequest)
        {
            return BadRequest(new { message = "Username must be 3 to 50 characters." });     // 400
        }

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogError("Data API returned {Status} during signup", (int)response.StatusCode);
            return ServiceUnavailable();
        }

        var user = await response.Content.ReadFromJsonAsync<DataApiUser>();
        _logger.LogInformation("New user signed up: {Username}", user!.Username);

        return StatusCode(201, new SignupResponse { Username = user.Username, UserKey = user.UserKey });
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginRequest request)
    {
        // A key that is not even a GUID can never be valid
        if (!Guid.TryParse(request.UserKey.Trim(), out Guid userKey))
        {
            return InvalidLogin();
        }

        HttpResponseMessage response;
        try
        {
            response = await _dataApi.VerifyUserAsync(request.Username.Trim(), userKey);
        }
        catch (Exception ex) when (ex is HttpRequestException || ex is TaskCanceledException)
        {
            _logger.LogError(ex, "Data API unreachable during login");
            return ServiceUnavailable();
        }

        if (response.StatusCode == HttpStatusCode.Unauthorized || response.StatusCode == HttpStatusCode.BadRequest)
        {
            return InvalidLogin();
        }

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogError("Data API returned {Status} during login", (int)response.StatusCode);
            return ServiceUnavailable();
        }

        var user = await response.Content.ReadFromJsonAsync<DataApiUser>();

        // Username + key are correct: give the browser a signed token.
        // The role ("admin" or "customer") goes INTO the token, so other services
        // can check it without asking auth-api.
        string role = _roles.GetRole(user!.Username);
        LoginResponse login = _jwt.CreateToken(user.Id, user.Username, role);
        return Ok(login);
    }

    // [Authorize] = the JwtBearer middleware must find a VALID token
    // (correct signature, issuer, audience, not expired). Otherwise 401 automatically.
    [Authorize]
    [HttpGet("me")]
    public IActionResult Me()
    {
        // Read the claims we put into the token at login
        string? id = User.FindFirst("sub")?.Value;
        string? username = User.FindFirst("name")?.Value;

        // Tokens created before roles existed have no "role" claim: treat as customer
        string role = User.FindFirst("role")?.Value ?? AdminRoleService.CustomerRole;

        return Ok(new MeResponse { Id = int.Parse(id ?? "0"), Username = username ?? "", Role = role });
    }

    // Same message for "wrong username" and "wrong key", so attackers can't
    // find out which usernames exist.
    private IActionResult InvalidLogin()
    {
        return Unauthorized(new { message = "Invalid username or user key." });              // 401
    }

    private IActionResult ServiceUnavailable()
    {
        return StatusCode(503, new { message = "Sign in is temporarily unavailable. Please try again." });
    }
}
