using DataApi.Models;
using DataApi.Services;
using Microsoft.AspNetCore.Mvc;

namespace DataApi.Controllers;

/// <summary>
/// CRUD endpoints for users.
///   GET    /users          -> list users
///   GET    /users/{id}     -> one user
///   POST   /users          -> create user (signup), returns the UserKey once
///   PUT    /users/{id}     -> update username
///   DELETE /users/{id}     -> delete user
///   POST   /users/verify   -> check username + UserKey (login)
/// </summary>
[ApiController]
[Route("users")]
public class UsersController : ControllerBase
{
    private readonly UserService _userService;

    public UsersController(UserService userService)
    {
        _userService = userService;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var users = await _userService.GetAllAsync();
        return Ok(users);
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var user = await _userService.GetByIdAsync(id);
        if (user == null)
        {
            return NotFound(new { message = $"User {id} not found." });
        }

        return Ok(user);
    }

    [HttpPost]
    public async Task<IActionResult> Create(CreateUserRequest request)
    {
        var created = await _userService.CreateAsync(request.Username);
        if (created == null)
        {
            return Conflict(new { message = $"Username '{request.Username}' already exists." });   // 409
        }

        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);              // 201
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, UpdateUserRequest request)
    {
        var result = await _userService.UpdateAsync(id, request.Username);

        if (result == UpdateResult.NotFound)
        {
            return NotFound(new { message = $"User {id} not found." });
        }

        if (result == UpdateResult.DuplicateUsername)
        {
            return Conflict(new { message = $"Username '{request.Username}' already exists." });
        }

        return NoContent();   // 204 = success, nothing to return
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        bool deleted = await _userService.DeleteAsync(id);
        if (!deleted)
        {
            return NotFound(new { message = $"User {id} not found." });
        }

        return NoContent();
    }

    [HttpPost("verify")]
    public async Task<IActionResult> Verify(VerifyUserRequest request)
    {
        var user = await _userService.VerifyAsync(request.Username, request.UserKey);
        if (user == null)
        {
            return Unauthorized(new { message = "Invalid username or user key." });   // 401
        }

        return Ok(user);
    }
}
