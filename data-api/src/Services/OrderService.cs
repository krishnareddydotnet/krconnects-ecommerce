using DataApi.Data;
using DataApi.Models;
using Microsoft.EntityFrameworkCore;

namespace DataApi.Services;

/// <summary>
/// All database logic for orders lives here.
/// </summary>
public class OrderService
{
    private readonly DataDbContext _db;

    public OrderService(DataDbContext db)
    {
        _db = db;
    }

    // CREATE: the order AND its items (null if the order number already exists)
    public async Task<Order?> CreateAsync(CreateOrderRequest request)
    {
        bool numberTaken = await _db.Orders.AnyAsync(o => o.OrderNumber == request.OrderNumber);
        if (numberTaken)
        {
            return null;
        }

        var order = new Order
        {
            OrderNumber = request.OrderNumber,
            UserId = request.UserId,
            Username = request.Username.Trim(),
            Status = request.Status.Trim(),
            Subtotal = request.Subtotal,
            Delivery = request.Delivery,
            Total = request.Total,
            CreatedAt = DateTime.UtcNow
        };

        foreach (var item in request.Items)
        {
            order.Items.Add(new OrderItem
            {
                ProductId = item.ProductId,
                ProductName = item.ProductName.Trim(),
                UnitPrice = item.UnitPrice,
                Quantity = item.Quantity,
                LineTotal = item.LineTotal
            });
        }

        // ONE SaveChanges = ONE database transaction: EF Core inserts the order
        // and all its items together. If any insert fails, nothing is saved,
        // so we never end up with an order without items (or the other way round).
        _db.Orders.Add(order);
        await _db.SaveChangesAsync();

        return order;
    }

    // READ: all orders of one user, newest first, with their items
    public async Task<List<Order>> GetByUserAsync(int userId)
    {
        return await _db.Orders
            .Include(o => o.Items)                     // also load the order lines
            .Where(o => o.UserId == userId)
            .OrderByDescending(o => o.CreatedAt)
            .ThenByDescending(o => o.Id)               // same time? newest id first
            .ToListAsync();
    }

    // READ: one order with its items (null if not found)
    public async Task<Order?> GetByIdAsync(int id)
    {
        return await _db.Orders
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == id);
    }
}
