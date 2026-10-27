namespace DataApi.Models;

/// <summary>
/// One row in the "Users" table.
/// </summary>
public class User
{
    public int Id { get; set; }                       // primary key (auto number)
    public string Username { get; set; } = "";        // must be unique
    public Guid UserKey { get; set; }                 // secret unique id, acts like a password (demo only)
    public DateTime CreatedAt { get; set; }           // when the user signed up (UTC)
}
