using AuthApi.Services;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace AuthApi.Tests;

/// <summary>
/// Tests who gets the "admin" role, based on the Admin:Usernames setting.
/// </summary>
public class AdminRoleServiceTests
{
    private static AdminRoleService CreateService(string? adminUsernames)
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["Admin:Usernames"] = adminUsernames })
            .Build();

        return new AdminRoleService(configuration);
    }

    [Fact]
    public void NoSetting_EveryoneIsCustomer()
    {
        var service = CreateService(null);

        Assert.Equal("customer", service.GetRole("admin"));
    }

    [Fact]
    public void UsernameInList_IsAdmin()
    {
        var service = CreateService("admin,krishna");

        Assert.Equal("admin", service.GetRole("krishna"));
        Assert.Equal("customer", service.GetRole("ravi"));
    }

    [Fact]
    public void List_IgnoresSpacesAndCase()
    {
        var service = CreateService(" Admin , ,KRISHNA ");

        Assert.Equal("admin", service.GetRole("admin"));
        Assert.Equal("admin", service.GetRole("krishna"));
    }

    [Fact]
    public void EmptyEntries_DoNotMakeEmptyUsernameAdmin()
    {
        var service = CreateService(",,");

        Assert.Equal("customer", service.GetRole(""));
    }
}
