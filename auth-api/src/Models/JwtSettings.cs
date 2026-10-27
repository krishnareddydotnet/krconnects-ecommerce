namespace AuthApi.Models;

/// <summary>
/// JWT settings, read from the "Jwt" section of configuration.
///
///   Jwt:Key           -> secret used to SIGN tokens (min 32 characters).
///                        NEVER in appsettings.json or Git: in Kubernetes it comes
///                        from the "auth-api-secret" Secret as env var Jwt__Key.
///   Jwt:Issuer        -> who created the token (this service)
///   Jwt:Audience      -> who the token is for (the customer portal)
///   Jwt:ExpiryMinutes -> how long a login lasts
/// </summary>
public class JwtSettings
{
    public string Key { get; set; } = "";
    public string Issuer { get; set; } = "krconnects-auth-api";
    public string Audience { get; set; } = "krconnects-customer-portal";
    public int ExpiryMinutes { get; set; } = 60;
}
