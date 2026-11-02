using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using AuthApi.Services;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.JsonWebTokens;
using Xunit;

namespace AuthApi.Tests;

/// <summary>
/// Tests for /auth/signup, /auth/login and /auth/me.
/// The real Data API is replaced by FakeDataApiHandler, so no database is needed.
/// </summary>
public class AuthControllerTests : IClassFixture<WebApplicationFactory<Program>>
{
    // Test-only signing key (64 x 'k'), built in code so it is clearly not a real secret
    private static readonly string TestJwtKey = new string('k', 64);

    private static readonly Guid KrishnaKey = Guid.Parse("11111111-2222-3333-4444-555555555555");

    private readonly WebApplicationFactory<Program> _factory;

    public AuthControllerTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    // Creates an HttpClient for auth-api where:
    //  - Jwt:Key is the test key
    //  - every call to the Data API goes to our fake handler
    //  - Admin:Usernames is the given list (default: nobody is an admin)
    private HttpClient CreateClient(FakeDataApiHandler fakeDataApi, string adminUsernames = "")
    {
        return _factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureAppConfiguration((context, config) =>
            {
                config.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["Jwt:Key"] = TestJwtKey,
                    ["Admin:Usernames"] = adminUsernames
                });
            });

            builder.ConfigureTestServices(services =>
            {
                services.AddHttpClient<DataApiClient>()
                        .ConfigurePrimaryHttpMessageHandler(() => fakeDataApi);
            });
        }).CreateClient();
    }

    [Fact]
    public async Task Signup_NewUsername_Returns201WithUserKey()
    {
        var fake = new FakeDataApiHandler();
        var client = CreateClient(fake);

        var response = await client.PostAsJsonAsync("/auth/signup", new { username = "krishna" });
        var body = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Contains(KrishnaKey.ToString(), body);
        Assert.Equal("/users", fake.LastPath);   // auth-api really called the Data API
    }

    [Fact]
    public async Task Signup_ExistingUsername_Returns409()
    {
        var client = CreateClient(new FakeDataApiHandler());

        var response = await client.PostAsJsonAsync("/auth/signup", new { username = "taken" });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task Signup_TooShortUsername_Returns400()
    {
        var client = CreateClient(new FakeDataApiHandler());

        var response = await client.PostAsJsonAsync("/auth/signup", new { username = "ab" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Login_CorrectKey_ReturnsToken()
    {
        var client = CreateClient(new FakeDataApiHandler());

        var response = await client.PostAsJsonAsync("/auth/login", new { username = "krishna", userKey = KrishnaKey.ToString() });
        var login = await response.Content.ReadFromJsonAsync<LoginResult>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.False(string.IsNullOrEmpty(login!.Token));
        Assert.Equal("krishna", login.Username);
    }

    [Fact]
    public async Task Login_WrongKey_Returns401()
    {
        var client = CreateClient(new FakeDataApiHandler());

        var response = await client.PostAsJsonAsync("/auth/login", new { username = "krishna", userKey = Guid.NewGuid().ToString() });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Login_KeyNotAGuid_Returns401()
    {
        var client = CreateClient(new FakeDataApiHandler());

        var response = await client.PostAsJsonAsync("/auth/login", new { username = "krishna", userKey = "not-a-key" });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Me_WithToken_ReturnsUsername()
    {
        var client = CreateClient(new FakeDataApiHandler());

        // 1. Log in to get a token
        var loginResponse = await client.PostAsJsonAsync("/auth/login", new { username = "krishna", userKey = KrishnaKey.ToString() });
        var login = await loginResponse.Content.ReadFromJsonAsync<LoginResult>();

        // 2. Call /auth/me with "Authorization: Bearer <token>"
        var request = new HttpRequestMessage(HttpMethod.Get, "/auth/me");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", login!.Token);
        var response = await client.SendAsync(request);
        var body = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains("krishna", body);
    }

    [Fact]
    public async Task Me_WithoutToken_Returns401()
    {
        var client = CreateClient(new FakeDataApiHandler());

        var response = await client.GetAsync("/auth/me");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Me_WithFakeToken_Returns401()
    {
        var client = CreateClient(new FakeDataApiHandler());

        var request = new HttpRequestMessage(HttpMethod.Get, "/auth/me");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", "abc.def.ghi");
        var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    // ----- Roles -----

    [Fact]
    public async Task Login_UserNotInAdminList_TokenHasRoleCustomer()
    {
        var client = CreateClient(new FakeDataApiHandler(), adminUsernames: "someone-else");

        string token = await LoginAndGetToken(client);

        Assert.Equal("customer", new JsonWebToken(token).GetClaim("role").Value);
    }

    [Fact]
    public async Task Login_UserInAdminList_TokenHasRoleAdmin()
    {
        // Case and spaces don't matter: " Krishna " matches "krishna"
        var client = CreateClient(new FakeDataApiHandler(), adminUsernames: "boss, Krishna ");

        string token = await LoginAndGetToken(client);

        Assert.Equal("admin", new JsonWebToken(token).GetClaim("role").Value);
    }

    [Fact]
    public async Task Me_ReturnsRole()
    {
        var client = CreateClient(new FakeDataApiHandler(), adminUsernames: "krishna");
        string token = await LoginAndGetToken(client);

        var request = new HttpRequestMessage(HttpMethod.Get, "/auth/me");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        var response = await client.SendAsync(request);
        var me = await response.Content.ReadFromJsonAsync<MeResult>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("krishna", me!.Username);
        Assert.Equal("admin", me.Role);
    }

    private static async Task<string> LoginAndGetToken(HttpClient client)
    {
        var response = await client.PostAsJsonAsync("/auth/login", new { username = "krishna", userKey = KrishnaKey.ToString() });
        var login = await response.Content.ReadFromJsonAsync<LoginResult>();
        return login!.Token;
    }

    // Shape of the /auth/me response, for reading it in tests
    private class MeResult
    {
        public int Id { get; set; }
        public string Username { get; set; } = "";
        public string Role { get; set; } = "";
    }

    // Shape of the /auth/login response, for reading it in tests
    private class LoginResult
    {
        public string Token { get; set; } = "";
        public string Username { get; set; } = "";
    }

    /// <summary>
    /// Pretends to be the Data API:
    ///   POST /users         -> 409 for "taken", otherwise 201 with KrishnaKey
    ///   POST /users/verify  -> 200 only for krishna + KrishnaKey, otherwise 401
    /// </summary>
    private class FakeDataApiHandler : HttpMessageHandler
    {
        public string? LastPath { get; private set; }

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            LastPath = request.RequestUri!.AbsolutePath;
            var body = await request.Content!.ReadFromJsonAsync<Dictionary<string, string>>(cancellationToken);

            if (LastPath == "/users")
            {
                if (body!["username"] == "taken")
                {
                    return new HttpResponseMessage(HttpStatusCode.Conflict);
                }

                return new HttpResponseMessage(HttpStatusCode.Created)
                {
                    Content = JsonContent.Create(new { id = 1, username = body["username"], userKey = KrishnaKey })
                };
            }

            if (LastPath == "/users/verify")
            {
                if (body!["username"] == "krishna" && Guid.Parse(body["userKey"]) == KrishnaKey)
                {
                    return new HttpResponseMessage(HttpStatusCode.OK)
                    {
                        Content = JsonContent.Create(new { id = 1, username = "krishna" })
                    };
                }

                return new HttpResponseMessage(HttpStatusCode.Unauthorized);
            }

            return new HttpResponseMessage(HttpStatusCode.NotFound);
        }
    }
}
