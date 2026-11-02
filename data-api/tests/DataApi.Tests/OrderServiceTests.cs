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
    // ----- Admin: paging and status -----

    [Fact]
    public async Task GetPage_ReturnsNewestFirstWithTotals()
    {
        var service = CreateService();
        for (int i = 1; i <= 5; i++)
        {
            await service.CreateAsync(SampleRequest($"KRC-20261031-PAGE0{i}", userId: i));
        }

        var page1 = await service.GetPageAsync(1, 2);
        var page3 = await service.GetPageAsync(3, 2);

        Assert.Equal(5, page1.TotalCount);
        Assert.Equal(3, page1.TotalPages);                       // 5 / 2 = 2.5 -> 3 pages
        Assert.Equal("KRC-20261031-PAGE05", page1.Items[0].OrderNumber);   // newest first
        Assert.Equal(2, page1.Items[0].Items.Count);             // order lines included
        Assert.Single(page3.Items);                              // last page has the rest
        Assert.Equal("KRC-20261031-PAGE01", page3.Items[0].OrderNumber);
    }

    [Fact]
    public async Task GetPage_BadValues_AreCorrected()
    {
        var service = CreateService();

        var result = await service.GetPageAsync(0, 1000);

        Assert.Equal(1, result.Page);
        Assert.Equal(100, result.PageSize);
        Assert.Equal(0, result.TotalCount);
        Assert.Equal(0, result.TotalPages);
    }

    [Fact]
    public async Task UpdateStatus_ChangesStatus()
    {
        var service = CreateService();
        var created = await service.CreateAsync(SampleRequest());

        var updated = await service.UpdateStatusAsync(created!.Id, "Shipped");
        var reloaded = await service.GetByIdAsync(created.Id);

        Assert.Equal("Shipped", updated!.Status);
        Assert.Equal("Shipped", reloaded!.Status);
    }

    [Fact]
    public async Task UpdateStatus_UnknownId_ReturnsNull()
    {
        var service = CreateService();

        var updated = await service.UpdateStatusAsync(9999, "Shipped");

        Assert.Null(updated);
    }

    [Theory]
    [InlineData("Placed", true)]
    [InlineData("Shipped", true)]
    [InlineData("Delivered", true)]
    [InlineData("Cancelled", true)]
    [InlineData("shipped", false)]
    [InlineData("Lost", false)]
    [InlineData("", false)]
    public void OrderStatuses_OnlyAllowsKnownValues(string status, bool expected)
    {
        Assert.Equal(expected, OrderStatuses.IsValid(status));
    }
}
