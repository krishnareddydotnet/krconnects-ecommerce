namespace DataApi.Models;

// -----------------------------------------------------------------------
// Response bodies (what the Data API RETURNS).
// UserResponse never includes the UserKey, so the secret is not leaked
// when listing or reading users.
// -----------------------------------------------------------------------

public class UserResponse
{
    public int Id { get; set; }
    public string Username { get; set; } = "";
    public DateTime CreatedAt { get; set; }
}

// Returned ONLY once, right after signup, so the user can save their key.
public class CreatedUserResponse
{
    public int Id { get; set; }
    public string Username { get; set; } = "";
    public Guid UserKey { get; set; }
    public DateTime CreatedAt { get; set; }
}
