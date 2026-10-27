using System.ComponentModel.DataAnnotations;

namespace DataApi.Models;

// -----------------------------------------------------------------------
// Request bodies (what callers SEND to the Data API).
// [Required] / [StringLength] are checked automatically by ASP.NET Core:
// invalid input returns 400 Bad Request before our code even runs.
// -----------------------------------------------------------------------

public class CreateUserRequest
{
    [Required]
    [StringLength(50, MinimumLength = 3)]
    public string Username { get; set; } = "";
}

public class UpdateUserRequest
{
    [Required]
    [StringLength(50, MinimumLength = 3)]
    public string Username { get; set; } = "";
}

public class VerifyUserRequest
{
    [Required]
    public string Username { get; set; } = "";

    [Required]
    public Guid UserKey { get; set; }
}
