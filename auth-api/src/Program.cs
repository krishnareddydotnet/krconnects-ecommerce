// -----------------------------------------------------------------------
// KRConnects Auth API
// Responsible for sign up, log in (JWT) and "who am I".
//
// - Users are stored by the Data API (auth-api never talks to the database).
// - Secrets (Jwt:Key) come from a Kubernetes Secret as environment variables,
//   never from appsettings.json or Git. Later: Azure Key Vault.
// -----------------------------------------------------------------------

using System.Text;
using AuthApi.Models;
using AuthApi.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddSingleton<IAuthInfoService, AuthInfoService>();

// ----- JWT settings (section "Jwt") -----
builder.Services.Configure<JwtSettings>(builder.Configuration.GetSection("Jwt"));
builder.Services.AddSingleton<JwtTokenService>();

// ----- Data API client -----
// Address of the Data API: env var DataApi__Url, default = Kubernetes Service name
string dataApiUrl = builder.Configuration["DataApi:Url"] ?? "http://data-api:8080";
builder.Services.AddHttpClient<DataApiClient>(client =>
{
    client.BaseAddress = new Uri(dataApiUrl);
    client.Timeout = TimeSpan.FromSeconds(5);   // don't wait forever if Data API is down
});

// ----- Validate JWTs sent in "Authorization: Bearer <token>" -----
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer();

// The rules are set here (reading JwtSettings when the first request arrives)
builder.Services.AddOptions<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme)
    .Configure<IOptions<JwtSettings>>((options, jwtOptions) =>
    {
        JwtSettings jwt = jwtOptions.Value;

        // No key configured -> no signing key -> every token is rejected (401), app keeps running
        SecurityKey? signingKey = string.IsNullOrWhiteSpace(jwt.Key)
            ? null
            : new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.Key));

        options.MapInboundClaims = false;   // keep claim names as "sub" and "name"
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwt.Issuer,
            ValidateAudience = true,
            ValidAudience = jwt.Audience,
            ValidateLifetime = true,                       // expired token -> 401
            ClockSkew = TimeSpan.FromMinutes(1),
            ValidateIssuerSigningKey = true,               // changed token -> 401
            IssuerSigningKey = signingKey,
            NameClaimType = "name"
        };
    });

builder.Services.AddAuthorization();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseAuthentication();   // reads the token and sets "User"
app.UseAuthorization();    // enforces [Authorize]

app.MapControllers();

// GET / - simple root identifier so hitting the base URL immediately
// shows which app this is, without needing to know a specific route.
app.MapGet("/", () => Results.Ok(new
{
    message = "This is the KRConnects Auth API.",
    service = "krconnects-auth-api",
    timestamp = DateTime.UtcNow.ToString("o")
}));

app.Run();

// Exposes Program for WebApplicationFactory-based integration tests.
public partial class Program { }
