// -----------------------------------------------------------------------
// KRConnects Data API
// The ONLY service that talks to the database. Other services (auth-api,
// catalog-api, later orders) call this API instead of connecting to
// SQL Server directly.
//
// Connection string comes from configuration key "ConnectionStrings:DataDb".
// In Kubernetes it is injected as the environment variable
//   ConnectionStrings__DataDb   (from a Kubernetes Secret)
// It is NEVER stored in appsettings.json (public repo).
// -----------------------------------------------------------------------

using DataApi.Data;
using DataApi.Services;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// 1. Read the connection string (fail fast with a clear message if missing)
string? connectionString = builder.Configuration.GetConnectionString("DataDb");
if (string.IsNullOrWhiteSpace(connectionString))
{
    throw new InvalidOperationException(
        "Connection string 'DataDb' is missing. Set the environment variable 'ConnectionStrings__DataDb'.");
}

// 2. Register services
builder.Services.AddControllers();
builder.Services.AddDbContext<DataDbContext>(options => options.UseSqlServer(connectionString));
builder.Services.AddScoped<UserService>();
builder.Services.AddScoped<ProductService>();

var app = builder.Build();

// 3. Prepare the database
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<DataDbContext>();

    // 3a. Create the database and tables if the DATABASE doesn't exist yet.
    //     SQL Server may still be starting, so retry a few times before giving up.
    for (int attempt = 1; attempt <= 10; attempt++)
    {
        try
        {
            db.Database.EnsureCreated();
            app.Logger.LogInformation("Database is ready.");
            break;
        }
        catch (Exception ex)
        {
            app.Logger.LogWarning("Database not ready (attempt {Attempt}/10): {Error}", attempt, ex.Message);

            if (attempt == 10)
            {
                throw;   // give up: the pod restarts and tries again
            }

            Thread.Sleep(TimeSpan.FromSeconds(5));
        }
    }

    // 3b. IMPORTANT: EnsureCreated() does NOTHING if the database already exists.
    //     Our database was created earlier with only the Users table, so we
    //     add the Products table ourselves if it is missing.
    //     (Real projects use "EF Core Migrations" for schema changes like this.)
    db.Database.ExecuteSqlRaw(@"
        IF OBJECT_ID(N'dbo.Products', N'U') IS NULL
        BEGIN
            CREATE TABLE dbo.Products (
                Id       INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
                Name     NVARCHAR(100)     NOT NULL,
                Category NVARCHAR(50)      NOT NULL,
                Price    DECIMAL(10,2)     NOT NULL
            );
        END");

    // 3c. Add the ImageUrl column if it is missing (table was created before images existed)
    db.Database.ExecuteSqlRaw(@"
        IF COL_LENGTH(N'dbo.Products', N'ImageUrl') IS NULL
        BEGIN
            ALTER TABLE dbo.Products ADD ImageUrl NVARCHAR(200) NULL;
        END");

    // 3d. Insert any demo product that is not in the table yet (matched by Name).
    //     Safe to run on every start: existing rows are never changed or deleted.
    var seedProducts = ProductSeedData.GetProducts();
    var existingNames = db.Products.Select(p => p.Name).ToHashSet();
    var missingProducts = seedProducts.Where(p => !existingNames.Contains(p.Name)).ToList();

    if (missingProducts.Count > 0)
    {
        db.Products.AddRange(missingProducts);
        db.SaveChanges();
        app.Logger.LogInformation("Added {Count} demo products.", missingProducts.Count);
    }

    // 3e. Give older products (created before images existed) their image path
    var imagePathByName = seedProducts.ToDictionary(p => p.Name, p => p.ImageUrl);
    var productsWithoutImage = db.Products.Where(p => p.ImageUrl == null).ToList();
    int updated = 0;

    foreach (var product in productsWithoutImage)
    {
        if (imagePathByName.TryGetValue(product.Name, out string? imagePath))
        {
            product.ImageUrl = imagePath;
            updated++;
        }
    }

    if (updated > 0)
    {
        db.SaveChanges();
        app.Logger.LogInformation("Set image path for {Count} products.", updated);
    }
}

// 4. Endpoints
app.MapControllers();

// GET / - shows which app this is
app.MapGet("/", () => Results.Ok(new
{
    message = "This is the KRConnects Data API — responsible for database CRUD operations.",
    service = "krconnects-data-api",
    timestamp = DateTime.UtcNow.ToString("o")
}));

app.Run();
