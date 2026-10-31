using System.ComponentModel.DataAnnotations;

namespace AuthApi.Models;

// -----------------------------------------------------------------------
// Request bodies sent by the customer portal (browser).
// [Required] / [StringLength] are checked automatically by ASP.NET Core:
// invalid input returns 400 Bad Request before our code runs.
// -----------------------------------------------------------------------

public class SignupRequest
{
    [Required]
    [StringLength(50, MinimumLength = 3)]
    public string Username { get; set; } = "";
}

public class LoginRequest
{
    [Required]
    public string Username { get; set; } = "";

    // Kept as a string here; we check it is a valid GUID ourselves,
    // so a badly typed key gives "Invalid username or user key" (401), not 400.
    [Required]
    public string UserKey { get; set; } = "";
}

// -----------------------------------------------------------------------
// Responses sent back to the customer portal.
// -----------------------------------------------------------------------

public class SignupResponse
{
    public string Username { get; set; } = "";
    public Guid UserKey { get; set; }          // shown to the user ONCE
}

public class LoginResponse
{
    public string Token { get; set; } = "";    // the JWT
    public string Username { get; set; } = "";
    public DateTime ExpiresAt { get; set; }
}

public class MeResponse
{
    public int Id { get; set; }
    public string Username { get; set; } = "";
    public string Role { get; set; } = "";     // "admin" or "customer"
}

// -----------------------------------------------------------------------
// What the Data API returns for a user (we only read the fields we need).
// -----------------------------------------------------------------------

public class DataApiUser
{
    public int Id { get; set; }
    public string Username { get; set; } = "";
    public Guid UserKey { get; set; }          // only filled by POST /users (signup)
}
