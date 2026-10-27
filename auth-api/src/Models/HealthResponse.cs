namespace AuthApi.Models;

/// <summary>
/// Response returned by the /health/* endpoints.
/// Kept intentionally lightweight since Kubernetes probes call these
/// endpoints repeatedly for the entire lifetime of the pod.
/// </summary>
public class HealthResponse
{
    public string Status { get; set; } = string.Empty;
    public string Service { get; set; } = string.Empty;
    public string Probe { get; set; } = string.Empty;
    public string Timestamp { get; set; } = string.Empty;
    public object? Dependencies { get; set; }
}
