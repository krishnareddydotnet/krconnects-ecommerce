namespace AuthApi.Models;

/// <summary>
/// Response returned by the /hello endpoint.
/// Identifies the service and proves a live round-trip call occurred,
/// since Timestamp is generated server-side on every request.
/// </summary>
public class HelloResponse
{
    public string Message { get; set; } = string.Empty;
    public string Service { get; set; } = string.Empty;
    public string Timestamp { get; set; } = string.Empty;
}
