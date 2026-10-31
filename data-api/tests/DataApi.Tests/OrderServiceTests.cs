using DataApi.Data;
using DataApi.Models;
using DataApi.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace DataApi.Tests;

/// <summary>
/// Tests the order logic using an in-memory database.
/// Each test gets its own fresh, empty database.
/// </summary>
public class OrderServiceTests
{
    private static OrderService CreateService()
    {
        var options = new DbContextOptionsBuilder<DataDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        var db = new DataDbContext(options);
        return new OrderService(db);
    }

    // A valid order like order-api sends it: 2 x 1599 + 1 x 499 = 3697, free delivery
    private static CreateOrderRequest SampleRequest(string orderNumber = "KRC-20261031-AAAAAA", int userId = 1)
    {
        return new CreateOrderRequest
        {
            OrderNumber = orderNumber,
            UserId = userId,
            Username = "krishna",
            Status = "Placed",
            Subtotal = 3697m,
            Delivery = 0m,
            Total = 3697m,
            Items = new List<CreateOrderItemRequest>
            {
                new() { ProductId = 1, ProductName = "Wireless Mouse", UnitPrice = 1599m, Quantity = 2, LineTotal = 3198m },
                new() { ProductId = 4, ProductName = "Clean Code", UnitPrice = 499m, Quantity = 1, LineTotal = 499m }
            }
        };
    }

    [Fact]
    public async Task Create_SavesOrderWithItems()
    {
        var service = CreateService();

        var created = await service.CreateAsync(SampleRequest());

        Assert.NotNull(created);
        Assert.True(created!.Id > 0);
        Assert.Equal(2, created.Items.Count);
        Assert.All(created.Items, i => Assert.Equal(created.Id, i.OrderId));
    }

    [Fact]
    public async Task Create_SetsCreatedAtInUtc()
    {
        var service = CreateService();

        var created = await service.CreateAsync(SampleRequest());

        Assert.Equal(DateTimeKind.Utc, created!.CreatedAt.Kind);
        Assert.True(created.CreatedAt <= DateTime.UtcNow);
    }

    [Fact]
    public async Task Create_DuplicateOrderNumber_ReturnsNull()
    {
        var service = CreateService();
        await service.CreateAsync(SampleRequest("KRC-20261031-SAME01"));

        var duplicate = await service.CreateAsync(SampleRequest("KRC-20261031-SAME01"));

        Assert.Null(duplicate);
    }

    [Fact]
    public async Task GetById_ReturnsOrderWithItems()
    {
        var service = CreateService();
        var created = await service.CreateAsync(SampleRequest());

        var found = await service.GetByIdAsync(created!.Id);

        Assert.NotNull(found);
        Assert.Equal("KRC-20261031-AAAAAA", found!.OrderNumber);
        Assert.Equal(3697m, found.Total);
        Assert.Equal(2, found.Items.Count);
        Assert.Equal("Wireless Mouse", found.Items[0].ProductName);
    }

    [Fact]
    public async Task GetById_UnknownId_ReturnsNull()
    {
        var service = CreateService();

        var found = await service.GetByIdAsync(9999);

        Assert.Null(found);
    }

    [Fact]
    public async Task GetByUser_ReturnsOnlyThatUsersOrders_NewestFirst()
    {
        var service = CreateService();
        await service.CreateAsync(SampleRequest("KRC-20261031-FIRST1", userId: 1));
        await service.CreateAsync(SampleRequest("KRC-20261031-OTHER1", userId: 2));
        await service.CreateAsync(SampleRequest("KRC-20261031-SECOND", userId: 1));

        var orders = await service.GetByUserAsync(1);

        Assert.Equal(2, orders.Count);
        Assert.Equal("KRC-20261031-SECOND", orders[0].OrderNumber);   // newest first
        Assert.Equal("KRC-20261031-FIRST1", orders[1].OrderNumber);
        Assert.All(orders, o => Assert.Equal(2, o.Items.Count));       // items are included
    }

    [Fact]
    public async Task GetByUser_NoOrders_ReturnsEmptyList()
    {
        var service = CreateService();

        var orders = await service.GetByUserAsync(123);

        Assert.Empty(orders);
    }
}
