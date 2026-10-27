using Microsoft.AspNetCore.Mvc.Testing;
using System.Net;
using Xunit;

namespace AuthApi.Tests;

public class HelloControllerTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public HelloControllerTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Hello_ReturnsOk()
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync("/hello");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Hello_ContainsServiceName()
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync("/hello");
        var body = await response.Content.ReadAsStringAsync();

        Assert.Contains("krconnects-auth-api", body);
    }

    [Fact]
    public async Task Hello_ContainsTimestamp()
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync("/hello");
        var body = await response.Content.ReadAsStringAsync();

        Assert.Contains("timestamp", body, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Root_ReturnsOk()
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync("/");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Root_ContainsServiceName()
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync("/");
        var body = await response.Content.ReadAsStringAsync();

        Assert.Contains("krconnects-auth-api", body);
    }
}
