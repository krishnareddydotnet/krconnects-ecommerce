using DataApi.Data;
using DataApi.Models;
using Microsoft.EntityFrameworkCore;

namespace DataApi.Services;

// Possible results of an update, so the controller knows which HTTP status to return.
public enum UpdateResult
{
    Updated,
    NotFound,
    DuplicateUsername
}

/// <summary>
/// All database logic (CRUD) for users lives here.
/// The controller stays thin: it only handles HTTP in/out.
/// </summary>
public class UserService
{
    private readonly DataDbContext _db;

    public UserService(DataDbContext db)
    {
        _db = db;
    }

    // READ: all users (without their keys)
    public async Task<List<UserResponse>> GetAllAsync()
    {
        return await _db.Users
            .OrderBy(u => u.Id)
            .Select(u => new UserResponse { Id = u.Id, Username = u.Username, CreatedAt = u.CreatedAt })
            .ToListAsync();
    }

    // READ: one user by id (null if not found)
    public async Task<UserResponse?> GetByIdAsync(int id)
    {
        var user = await _db.Users.FindAsync(id);
        if (user == null)
        {
            return null;
        }

        return new UserResponse { Id = user.Id, Username = user.Username, CreatedAt = user.CreatedAt };
    }

    // CREATE: new user with a generated unique key (null if the username is already taken)
    public async Task<CreatedUserResponse?> CreateAsync(string username)
    {
        username = username.Trim();

        bool alreadyExists = await _db.Users.AnyAsync(u => u.Username == username);
        if (alreadyExists)
        {
            return null;
        }

        var user = new User
        {
            Username = username,
            UserKey = Guid.NewGuid(),          // random, hard to guess
            CreatedAt = DateTime.UtcNow
        };

        _db.Users.Add(user);
        await _db.SaveChangesAsync();          // INSERT happens here

        return new CreatedUserResponse
        {
            Id = user.Id,
            Username = user.Username,
            UserKey = user.UserKey,
            CreatedAt = user.CreatedAt
        };
    }

    // UPDATE: change the username
    public async Task<UpdateResult> UpdateAsync(int id, string newUsername)
    {
        newUsername = newUsername.Trim();

        var user = await _db.Users.FindAsync(id);
        if (user == null)
        {
            return UpdateResult.NotFound;
        }

        bool takenByAnotherUser = await _db.Users.AnyAsync(u => u.Username == newUsername && u.Id != id);
        if (takenByAnotherUser)
        {
            return UpdateResult.DuplicateUsername;
        }

        user.Username = newUsername;
        await _db.SaveChangesAsync();          // UPDATE happens here
        return UpdateResult.Updated;
    }

    // DELETE: remove a user (false if not found)
    public async Task<bool> DeleteAsync(int id)
    {
        var user = await _db.Users.FindAsync(id);
        if (user == null)
        {
            return false;
        }

        _db.Users.Remove(user);
        await _db.SaveChangesAsync();          // DELETE happens here
        return true;
    }

    // VERIFY: does this username + key match a user? (used by auth-api for login)
    public async Task<UserResponse?> VerifyAsync(string username, Guid userKey)
    {
        username = username.Trim();

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Username == username && u.UserKey == userKey);
        if (user == null)
        {
            return null;
        }

        return new UserResponse { Id = user.Id, Username = user.Username, CreatedAt = user.CreatedAt };
    }
}
