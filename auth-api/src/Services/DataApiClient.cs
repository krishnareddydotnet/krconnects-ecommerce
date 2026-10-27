using System.Net.Http.Json;

namespace AuthApi.Services;

/// <summary>
/// Calls the Data API over HTTP.
/// The Data API is the ONLY service that talks to the database,
/// so auth-api never connects to Azure SQL itself.
///
/// The address comes from configuration "DataApi:Url"
/// (default http://data-api:8080 = the Kubernetes Service name).
///
/// Methods return the raw HttpResponseMessage, so the controller can
/// decide what to do for each status code (201, 409, 401, ...).
/// </summary>
public class DataApiClient
{
    private readonly HttpClient _http;

    public DataApiClient(HttpClient http)
    {
        _http = http;
    }

    // POST /users  { username }  ->  201 Created (new user + key) or 409 Conflict (already exists)
    public Task<HttpResponseMessage> CreateUserAsync(string username)
    {
        return _http.PostAsJsonAsync("/users", new { username });
    }

    // POST /users/verify  { username, userKey }  ->  200 OK (user) or 401 Unauthorized
    public Task<HttpResponseMessage> VerifyUserAsync(string username, Guid userKey)
    {
        return _http.PostAsJsonAsync("/users/verify", new { username, userKey });
    }
}
