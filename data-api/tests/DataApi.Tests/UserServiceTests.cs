using DataApi.Data;
using DataApi.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace DataApi.Tests;

/// <summary>
/// Tests the CRUD logic using an in-memory database (no real SQL Server needed).
/// Each test gets its own fresh, empty database.
/// </summary>
public class UserServiceTests
{
    private static UserService CreateService()
    {
        var options = new DbContextOptionsBuilder<DataDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        var db = new DataDbContext(options);
        return new UserService(db);
    }

    [Fact]
    public async Task Create_ReturnsUserWithUniqueKey()
    {
        var service = CreateService();

        var created = await service.CreateAsync("krishna");

        Assert.NotNull(created);
        Assert.Equal("krishna", created!.Username);
        Assert.NotEqual(Guid.Empty, created.UserKey);
    }

    [Fact]
    public async Task Create_DuplicateUsername_ReturnsNull()
    {
        var service = CreateService();
        await service.CreateAsync("krishna");

        var duplicate = await service.CreateAsync("krishna");

        Assert.Null(duplicate);
    }

    [Fact]
    public async Task GetAll_ReturnsAllUsers()
    {
        var service = CreateService();
        await service.CreateAsync("user1");
        await service.CreateAsync("user2");

        var users = await service.GetAllAsync();

        Assert.Equal(2, users.Count);
    }

    [Fact]
    public async Task Verify_CorrectKey_ReturnsUser()
    {
        var service = CreateService();
        var created = await service.CreateAsync("krishna");

        var user = await service.VerifyAsync("krishna", created!.UserKey);

        Assert.NotNull(user);
    }

    [Fact]
    public async Task Verify_WrongKey_ReturnsNull()
    {
        var service = CreateService();
        await service.CreateAsync("krishna");

        var user = await service.VerifyAsync("krishna", Guid.NewGuid());

        Assert.Null(user);
    }

    [Fact]
    public async Task Update_ChangesUsername()
    {
        var service = CreateService();
        var created = await service.CreateAsync("oldname");

        var result = await service.UpdateAsync(created!.Id, "newname");
        var updated = await service.GetByIdAsync(created.Id);

        Assert.Equal(UpdateResult.Updated, result);
        Assert.Equal("newname", updated!.Username);
    }

    [Fact]
    public async Task Update_UnknownId_ReturnsNotFound()
    {
        var service = CreateService();

        var result = await service.UpdateAsync(999, "anyname");

        Assert.Equal(UpdateResult.NotFound, result);
    }

    [Fact]
    public async Task Delete_RemovesUser()
    {
        var service = CreateService();
        var created = await service.CreateAsync("krishna");

        bool deleted = await service.DeleteAsync(created!.Id);
        var afterDelete = await service.GetByIdAsync(created.Id);

        Assert.True(deleted);
        Assert.Null(afterDelete);
    }
}
