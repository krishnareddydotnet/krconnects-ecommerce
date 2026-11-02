using DataApi.Models;
using DataApi.Services;
using Microsoft.AspNetCore.Mvc;

namespace DataApi.Controllers;

/// <summary>
/// Order endpoints (called by order-api, never directly by the browser).
///   POST /orders                -> create order + items (one transaction)
///   GET  /orders/user/{userId}  -> orders of a user, newest first, with items
///   GET  /orders/{id}           -> one order with items
///   GET  /orders?page=1&amp;pageSize=20 -> one page of ALL orders, newest first (admin list)
///   PATCH /orders/{id}/status   -> change the status (admin), body { status }
///
/// The Data API does NOT check who is logged in: order-api does that
/// (only the user's own orders, and admin endpoints only for admins).
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

    [HttpGet]
    public async Task<IActionResult> GetPage([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var result = await _orderService.GetPageAsync(page, pageSize);
        return Ok(result);
    }

    [HttpPatch("{id:int}/status")]
    public async Task<IActionResult> UpdateStatus(int id, UpdateOrderStatusRequest request)
    {
        if (!OrderStatuses.IsValid(request.Status))
        {
            return BadRequest(new { message = "status must be one of: " + string.Join(", ", OrderStatuses.All) + "." });
        }

        var order = await _orderService.UpdateStatusAsync(id, request.Status);
        if (order == null)
        {
            return NotFound(new { message = $"Order {id} not found." });
        }

        return Ok(order);
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
