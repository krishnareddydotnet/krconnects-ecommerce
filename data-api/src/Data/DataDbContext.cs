using DataApi.Models;
using Microsoft.EntityFrameworkCore;

namespace DataApi.Data;

/// <summary>
/// EF Core "DbContext" = the connection between our C# classes and the database.
/// Each DbSet becomes a table.
/// </summary>
public class DataDbContext : DbContext
{
    public DataDbContext(DbContextOptions<DataDbContext> options) : base(options)
    {
    }

    public DbSet<User> Users => Set<User>();
    public DbSet<Product> Products => Set<Product>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // ----- Users -----
        // Username: required, max 50 characters, and UNIQUE (no duplicate usernames)
        modelBuilder.Entity<User>()
            .Property(u => u.Username)
            .HasMaxLength(50)
            .IsRequired();

        modelBuilder.Entity<User>()
            .HasIndex(u => u.Username)
            .IsUnique();

        // ----- Products -----
        modelBuilder.Entity<Product>()
            .Property(p => p.Name)
            .HasMaxLength(100)
            .IsRequired();

        modelBuilder.Entity<Product>()
            .Property(p => p.Category)
            .HasMaxLength(50)
            .IsRequired();

        modelBuilder.Entity<Product>()
            .Property(p => p.ImageUrl)
            .HasMaxLength(200);

        // Money: 10 digits in total, 2 after the decimal point (e.g. 12345678.99)
        modelBuilder.Entity<Product>()
            .Property(p => p.Price)
            .HasPrecision(10, 2);
    }
}
