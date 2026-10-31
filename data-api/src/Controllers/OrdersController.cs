using DataApi.Models;
using DataApi.Services;
using Microsoft.AspNetCore.Mvc;

namespace DataApi.Controllers;

/// <summary>
/// Order endpoints (called by order-api, never directly by the browser).
///   POST /orders                -> create order + items (one transaction)
///   GET  /orders/user/{userId}  -> orders of a user, newest first, with items
///   GET  /orders/{id}           -> one order with items
///
/// The Data API does NOT check who is logged in: order-api does that
/// and only asks for the orders of the logged-in user.
/// </summary>
[ApiController]
[Route("orders")]
public class OrdersController : ControllerBase
{
    private readonly OrderService _orderService;

    public OrdersController(OrderService orderService)
    {
        _orderService = orderService;
    }

    [HttpPost]
    public async Task<IActionResult> Create(CreateOrderRequest request)
    {
        var order = await _orderService.CreateAsync(request);
        if (order == null)
        {
            return Conflict(new { message = $"Order number '{request.OrderNumber}' already exists." });   // 409
        }

        return CreatedAtAction(nameof(GetById), new { id = order.Id }, order);                         // 201
    }

    [HttpGet("user/{userId:int}")]
    public async Task<IActionResult> GetByUser(int userId)
    {
        var orders = await _orderService.GetByUserAsync(userId);
        return Ok(orders);
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var order = await _orderService.GetByIdAsync(id);
        if (order == null)
        {
            return NotFound(new { message = $"Order {id} not found." });
        }

        return Ok(order);
    }
}
