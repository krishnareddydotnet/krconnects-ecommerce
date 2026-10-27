using AuthApi.Models;

namespace AuthApi.Services;

public interface IAuthInfoService
{
    HelloResponse GetHello();
    HealthResponse GetLiveness();
    HealthResponse GetReadiness();
    HealthResponse GetStartup();
}
