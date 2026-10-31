namespace AuthApi.Services;

/// <summary>
/// Decides the user's ROLE that goes into the login token: "admin" or "customer".
///
/// Admins are listed in configuration "Admin:Usernames" (comma-separated),
/// in Kubernetes the environment variable Admin__Usernames, e.g. "admin,krishna".
/// Default: empty = nobody is an admin.
///
/// Other services (catalog-api, order-api) read the "role" claim from the token
/// and allow admin-only endpoints only for role "admin".
/// </summary>
public class AdminRoleService
{
    public const string AdminRole = "admin";
    public const string CustomerRole = "customer";

    private readonly HashSet<string> _adminUsernames;

    public AdminRoleService(IConfiguration configuration)
    {
        string configured = configuration["Admin:Usernames"] ?? "";

        // Ignore case: SQL Server treats "Admin" and "admin" as the same username,
        // so the admin list must too.
        _adminUsernames = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (string name in configured.Split(','))
        {
            string trimmed = name.Trim();
            if (trimmed != "")
            {
                _adminUsernames.Add(trimmed);
            }
        }
    }

    public string GetRole(string username)
    {
        if (_adminUsernames.Contains(username.Trim()))
        {
            return AdminRole;
        }

        return CustomerRole;
    }
}
