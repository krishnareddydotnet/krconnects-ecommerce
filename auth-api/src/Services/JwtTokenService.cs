using System.Security.Claims;
using System.Text;
using AuthApi.Models;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace AuthApi.Services;

/// <summary>
/// Creates the JWT that the customer portal gets after a successful login.
///
/// A JWT has 3 parts:  header . payload . signature
///   payload   = "claims": who the user is (sub = user id, name = username) + expiry
///   signature = made with our secret Jwt:Key, so nobody can change the payload
/// </summary>
public class JwtTokenService
{
    private readonly JwtSettings _settings;

    public JwtTokenService(IOptions<JwtSettings> settings)
    {
        _settings = settings.Value;
    }

    public LoginResponse CreateToken(int userId, string username)
    {
        // HS256 needs a key of at least 256 bits (32 characters)
        if (string.IsNullOrWhiteSpace(_settings.Key) || _settings.Key.Length < 32)
        {
            throw new InvalidOperationException("Jwt:Key is missing or shorter than 32 characters.");
        }

        DateTime expiresAt = DateTime.UtcNow.AddMinutes(_settings.ExpiryMinutes);

        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Issuer = _settings.Issuer,
            Audience = _settings.Audience,
            Expires = expiresAt,
            Subject = new ClaimsIdentity(new[]
            {
                new Claim("sub", userId.ToString()),   // user id
                new Claim("name", username)            // username
            }),
            SigningCredentials = new SigningCredentials(
                new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_settings.Key)),
                SecurityAlgorithms.HmacSha256)
        };

        string token = new JsonWebTokenHandler().CreateToken(tokenDescriptor);

        return new LoginResponse
        {
            Token = token,
            Username = username,
            ExpiresAt = expiresAt
        };
    }
}
