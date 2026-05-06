# NestJS Reference

## Table of Contents
- [Architecture Overview](#architecture)
- [Modules](#modules)
- [Controllers](#controllers)
- [Providers & Services](#providers)
- [DTOs & Validation](#dtos)
- [Guards](#guards)
- [Interceptors](#interceptors)
- [Pipes](#pipes)
- [Middleware](#middleware)
- [Exception Filters](#exception-filters)
- [Database (TypeORM/Prisma)](#database)
- [PostgreSQL Raw SQL (pg, sin ORMs)](#raw-sql)
- [Authentication](#authentication)
- [Testing](#testing)
- [Project Structure](#project-structure)
- [Common Pitfalls](#common-pitfalls)

---

## Architecture

NestJS follows Angular's modular architecture with decorators:

```
Request -> Middleware -> Guards -> Interceptors (pre) -> Pipes -> Controller -> Interceptors (post) -> Exception Filters -> Response
```

Every piece is a class with a decorator, managed by the DI container.

---

## Modules

```typescript
// app.module.ts
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST'),
        port: config.get('DB_PORT'),
        username: config.get('DB_USER'),
        password: config.get('DB_PASS'),
        database: config.get('DB_NAME'),
        autoLoadEntities: true,
        synchronize: config.get('NODE_ENV') !== 'production',
        ssl: config.get('NODE_ENV') === 'production' ? { rejectUnauthorized: false } : false,
      }),
    }),
    UsersModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

// Feature module
@Module({
  imports: [TypeOrmModule.forFeature([User, Profile])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],   // make available to other modules
})
export class UsersModule {}

// Dynamic module
@Module({})
export class CacheModule {
  static register(options: CacheModuleOptions): DynamicModule {
    return {
      module: CacheModule,
      providers: [
        { provide: 'CACHE_OPTIONS', useValue: options },
        CacheService,
      ],
      exports: [CacheService],
    };
  }

  static registerAsync(options: CacheModuleAsyncOptions): DynamicModule {
    return {
      module: CacheModule,
      imports: options.imports ?? [],
      providers: [
        { provide: 'CACHE_OPTIONS', useFactory: options.useFactory, inject: options.inject ?? [] },
        CacheService,
      ],
      exports: [CacheService],
    };
  }
}
```

---

## Controllers

```typescript
// users.controller.ts
@Controller('users')                       // all routes prefixed /users
@UseGuards(AuthGuard('jwt'))               // guard applies to all routes
@ApiTags('Users')                          // Swagger group
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'List all users' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiResponse({ status: 200, type: [UserDto] })
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ): Promise<PaginatedResult<UserDto>> {
    return this.usersService.findPaginated(page, limit);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,       // validates UUID format
  ): Promise<UserDto> {
    return this.usersService.findOne(id);
  }

  @Post()
  @HttpCode(201)
  async create(@Body() dto: CreateUserDto): Promise<UserDto> {
    return this.usersService.create(dto);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserDto> {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.usersService.remove(id);
  }

  // Current user from JWT
  @Get('me/profile')
  getProfile(@Req() req: Request & { user: JwtPayload }) {
    return this.usersService.findOne(req.user.sub);
  }

  // File upload
  @Post(':id/avatar')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads/avatars',
      filename: (req, file, cb) => {
        const ext = extname(file.originalname);
        cb(null, `${req.params.id}-${Date.now()}${ext}`);
      },
    }),
    fileFilter: (req, file, cb) => {
      if (!file.mimetype.match(/^image\/(jpeg|png|webp)$/)) {
        cb(new BadRequestException('Only JPEG, PNG, WebP allowed'), false);
      }
      cb(null, true);
    },
    limits: { fileSize: 5 * 1024 * 1024 },  // 5MB
  }))
  uploadAvatar(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return { url: `/uploads/avatars/${file.filename}` };
  }

  // Response manipulation
  @Get(':id/download')
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'attachment; filename=report.pdf')
  async downloadReport(@Res() res: Response, @Param('id') id: string) {
    const pdf = await this.usersService.generateReport(id);
    res.end(pdf);
  }
}
```

---

## Providers & Services

```typescript
// users.service.ts
@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly cacheService: CacheService,
    @Inject('MAILER') private readonly mailer: MailerService,  // custom token injection
  ) {}

  async findOne(id: string): Promise<User> {
    // Try cache first
    const cached = await this.cacheService.get(`user:${id}`);
    if (cached) return JSON.parse(cached);

    const user = await this.userRepo.findOne({
      where: { id },
      relations: ['profile', 'roles'],     // eager load relations
    });

    if (!user) throw new NotFoundException(`User #${id} not found`);

    await this.cacheService.set(`user:${id}`, JSON.stringify(user), 300);
    return user;
  }

  async create(dto: CreateUserDto): Promise<User> {
    // Check uniqueness before insert
    const exists = await this.userRepo.findOne({ where: { email: dto.email } });
    if (exists) throw new ConflictException('Email already registered');

    // Use transaction for atomic operations
    const user = await this.userRepo.manager.transaction(async (manager) => {
      const newUser = manager.create(User, dto);
      const saved = await manager.save(newUser);

      // Create related entity
      const profile = manager.create(Profile, { userId: saved.id });
      await manager.save(profile);

      return saved;
    });

    // Send email in background (non-blocking)
    this.mailer.sendWelcome(user.email).catch(console.error);

    return user;
  }

  async findPaginated(page: number, limit: number): Promise<PaginatedResult<User>> {
    const [items, total] = await this.userRepo.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
      select: ['id', 'email', 'name', 'role', 'createdAt'], // exclude password
    });

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

// Custom provider with factory
@Module({
  providers: [
    {
      provide: 'MAILER',
      useFactory: (config: ConfigService) => {
        return config.get('NODE_ENV') === 'test'
          ? new FakeMailerService()
          : new SMTPMailerService(config.get('SMTP_HOST'));
      },
      inject: [ConfigService],
    },
  ],
})
export class AppModule {}
```

---

## DTOs & Validation

```typescript
import { IsEmail, IsString, MinLength, MaxLength, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
  MODERATOR = 'moderator',
}

export class CreateUserDto {
  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'Str0ngP@ss!' })
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  password: string;

  @ApiPropertyOptional({ enum: UserRole, default: UserRole.USER })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}

// Reuse DTO with partial fields
export class UpdateUserDto extends PartialType(CreateUserDto) {}

// Validation pipe at app level
// main.ts
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,              // strip non-whitelisted properties
  forbidNonWhitelisted: true,   // throw error on non-whitelisted
  transform: true,              // auto-transform payloads to DTO instances
  transformOptions: { enableImplicitConversion: true },
}));
```

---

## Guards

```typescript
// jwt-auth.guard.ts
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = JwtPayload>(err: any, user: TUser, info: any, context: ExecutionContext) {
    // Custom error message
    if (err || !user) {
      throw err || new UnauthorizedException('Invalid or expired token');
    }
    return user;
  }
}

// roles.guard.ts
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) return true;

    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.some((role) => user.roles?.includes(role));
  }
}

// Custom decorator for roles
export const Roles = (...roles: UserRole[]) => SetMetadata('roles', roles);

// Usage
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {}

// Throttle guard (rate limiting)
@Module({
  imports: [
    ThrottlerModule.forRoot([
      { ttl: 60000, limit: 10 },  // 10 req/min default
    ]),
  ],
})
export class AppModule {}

@Controller('auth')
export class AuthController {
  @Post('login')
  @Throttle({ default: { ttl: 60000, limit: 5 } })  // stricter: 5/min for login
  @SkipThrottle(false)
  async login() {}
}
```

---

## Interceptors

```typescript
// transform.interceptor.ts
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, Response<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<Response<T>> {
    return next.handle().pipe(
      map(data => ({
        success: true,
        data,
        timestamp: new Date().toISOString(),
        path: context.switchToHttp().getRequest().url,
      })),
    );
  }
}

// timeout.interceptor.ts
@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  constructor(private readonly timeout: number = 5000) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      timeout(this.timeout),
      catchError(err => {
        if (err instanceof TimeoutError) {
          throw new RequestTimeoutException('Request took too long');
        }
        return throwError(() => err);
      }),
    );
  }
}

// cache.interceptor.ts
@Injectable()
export class CacheInterceptor implements NestInterceptor {
  constructor(private readonly cache: CacheService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const key = `cache:${request.method}:${request.url}`;
    const cached = await this.cache.get(key);

    if (cached) {
      return of(JSON.parse(cached));
    }

    return next.handle().pipe(
      tap(async (data) => {
        await this.cache.set(key, JSON.stringify(data), 60);
      }),
    );
  }
}
```

---

## Pipes

```typescript
// Custom validation pipe for a specific transform
@Injectable()
export class ParseEmailPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      throw new BadRequestException('Invalid email format');
    }
    return value.toLowerCase().trim();
  }
}

// Usage inside controller
@Get('by-email/:email')
findByEmail(@Param('email', ParseEmailPipe) email: string) {}

// DTO validation wit additional business logic
@Injectable()
export class UniqueEmailPipe implements PipeTransform {
  constructor(private readonly usersService: UsersService) {}

  async transform(dto: CreateUserDto): Promise<CreateUserDto> {
    const exists = await this.usersService.findByEmail(dto.email);
    if (exists) {
      throw new BadRequestException('Email already in use');
    }
    return dto;
  }
}

// Inline transformation pipe
@Injectable()
export class TrimStringsPipe implements PipeTransform {
  transform(value: any) {
    if (typeof value === 'string') return value.trim();
    if (Array.isArray(value)) return value.map(v => typeof v === 'string' ? v.trim() : v);
    if (typeof value === 'object' && value !== null) {
      const trimmed = {};
      for (const [key, val] of Object.entries(value)) {
        trimmed[key] = typeof val === 'string' ? val.trim() : val;
      }
      return trimmed;
    }
    return value;
  }
}
```

---

## Middleware

```typescript
// logger.middleware.ts
@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  constructor(private readonly logger: LoggerService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();
    const { method, url } = req;

    res.on('finish', () => {
      const duration = Date.now() - start;
      this.logger.log(`${method} ${url} ${res.statusCode} ${duration}ms`);
    });

    next();
  }
}

// Apply in module
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LoggerMiddleware, HelmetMiddleware)
      .forRoutes('*');

    consumer
      .apply(RateLimitMiddleware)
      .forRoutes('auth');

    consumer
      .apply(LoggerMiddleware)
      .exclude({ path: 'health', method: RequestMethod.GET })
      .forRoutes('*');
  }
}
```

---

## Exception Filters

```typescript
// http-exception.filter.ts
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: LoggerService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = 500;
    let message = 'Internal server error';
    let errors: any = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        message = (res as any).message ?? exception.message;
        errors = (res as any).errors;
      }
    } else if (exception instanceof QueryFailedError) {
      status = 409;
      message = 'Database operation failed';
      // PostgreSQL specific: check code
      if ((exception as any).code === '23505') message = 'Duplicate entry';
    }

    if (status >= 500) {
      this.logger.error(`${request.method} ${request.url}`, exception instanceof Error ? exception.stack : '');
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      errors,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}

// Register in main.ts
app.useGlobalFilters(new GlobalExceptionFilter(app.get(LoggerService)));
```

---

## Database (TypeORM + Prisma)

### TypeORM Repository Pattern

```typescript
@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  // Complex queries with QueryBuilder
  async findByFilters(filters: UserFilters): Promise<User[]> {
    const qb = this.userRepo.createQueryBuilder('user')
      .leftJoinAndSelect('user.profile', 'profile')
      .leftJoinAndSelect('user.roles', 'roles');

    if (filters.email) qb.andWhere('user.email ILIKE :email', { email: `%${filters.email}%` });
    if (filters.role) qb.andWhere('roles.name = :role', { role: filters.role });
    if (filters.createdAfter) qb.andWhere('user.createdAt >= :after', { after: filters.createdAfter });
    if (filters.isActive !== undefined) qb.andWhere('user.isActive = :active', { active: filters.isActive });

    return qb.orderBy('user.createdAt', 'DESC').getMany();
  }

  // Raw SQL for complex aggregations
  async getUserStats(): Promise<UserStats[]> {
    return this.userRepo.query(`
      SELECT
        DATE_TRUNC('month', "createdAt") AS month,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE role = 'admin') AS admins
      FROM "user"
      WHERE "createdAt" >= NOW() - INTERVAL '12 months'
      GROUP BY month
      ORDER BY month DESC
    `);
  }
}
```

### Prisma Service

```typescript
// prisma.service.ts
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly config: ConfigService) {
    super({
      datasources: {
        db: {
          url: config.get('DATABASE_URL'),
        },
      },
      log: config.get('NODE_ENV') === 'development' 
        ? ['query', 'info', 'warn'] 
        : ['error'],
    });
  }

  async onModuleInit() { await this.$connect(); }
  async onModuleDestroy() { await this.$disconnect(); }
}

// Usage in service
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        profile: true,
        posts: {
          where: { published: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async createWithProfile(dto: CreateUserDto) {
    // Transaction with Prisma
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: dto });
      await tx.profile.create({ data: { userId: user.id } });
      return user;
    });
  }
}
```

---

## PostgreSQL Raw SQL (pg, sin ORMs)

Si prefieres SQL puro y stored procedures en lugar de ORMs:

```typescript
// database.service.ts - usando pg (node-postgres) puro
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Pool, QueryResult } from 'pg';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private pool: Pool;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    this.pool = new Pool({
      host: this.config.get('DB_HOST'),
      port: this.config.get('DB_PORT'),
      user: this.config.get('DB_USER'),
      password: this.config.get('DB_PASS'),
      database: this.config.get('DB_NAME'),
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      ssl: this.config.get('NODE_ENV') === 'production'
        ? { rejectUnauthorized: true } : false,
    });
  }

  async onModuleDestroy() {
    await this.pool?.end();
  }

  // Query simple con parametros (protege contra SQL injection)
  async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    const result = await this.pool.query(sql, params);
    return result.rows as T[];
  }

  // Query que retorna UNA fila
  async queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
    const result = await this.pool.query(sql, params);
    return (result.rows[0] as T) ?? null;
  }

  // Transaccion con callback
  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Ejecutar funcion/stored procedure de PostgreSQL
  async callProc<T = any>(procName: string, params?: any[]): Promise<T[]> {
    const placeholders = params?.map((_, i) => `$${i + 1}`).join(', ') ?? '';
    const sql = `SELECT * FROM ${procName}(${placeholders})`;
    return this.query<T>(sql, params);
  }
}

// users.service.ts - usando SQL PURO (sin ORM!)
@Injectable()
export class UsersService {
  constructor(private readonly db: DatabaseService) {}

  // Query con parametros tipados
  async findById(id: string): Promise<User | null> {
    return this.db.queryOne<User>(
      `SELECT id, email, name, role, created_at
       FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
  }

  // Query con filtros opcionales
  async findByFilters(filters: UserFilters): Promise<User[]> {
    const conditions: string[] = ['deleted_at IS NULL'];
    const params: any[] = [];
    let paramIdx = 1;

    if (filters.email) {
      conditions.push(`email ILIKE $${paramIdx++}`);
      params.push(`%${filters.email}%`);
    }
    if (filters.role) {
      conditions.push(`role = $${paramIdx++}`);
      params.push(filters.role);
    }
    if (filters.createdAfter) {
      conditions.push(`created_at >= $${paramIdx++}`);
      params.push(filters.createdAfter);
    }

    const sql = `
      SELECT id, email, name, role, created_at
      FROM users
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT $${paramIdx++} OFFSET $${paramIdx}
    `;
    params.push(filters.limit ?? 20, filters.offset ?? 0);

    return this.db.query<User>(sql, params);
  }

  // Insert con RETURNING (sin necesidad de SELECT extra)
  async create(dto: CreateUserDto): Promise<User> {
    return this.db.queryOne<User>(
      `INSERT INTO users (email, name, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, name, role, created_at`,
      [dto.email, dto.name, await bcrypt.hash(dto.password, 12), dto.role ?? 'user']
    );
  }

  // Llamar stored procedure
  async getDashboard(userId: string): Promise<DashboardData> {
    const [user, stats, recent] = await Promise.all([
      this.db.callProc<User>('get_user_by_id', [userId]),
      this.db.callProc<UserStats>('get_user_stats', [userId]),
      this.db.query('SELECT * FROM get_recent_orders($1)', [userId]),
    ]);
    return { user: user[0], stats: stats[0], recentOrders: recent };
  }

  // Transaccion multi-tabla (atomicidad)
  async transferCredits(fromId: string, toId: string, amount: number): Promise<void> {
    await this.db.transaction(async (client) => {
      // Deduct from sender
      const deduct = await client.query(
        'UPDATE users SET credits = credits - $1 WHERE id = $2 AND credits >= $1 RETURNING id',
        [amount, fromId]
      );
      if (deduct.rows.length === 0) {
        throw new BadRequestException('Insufficient credits');
      }

      // Add to receiver
      await client.query(
        'UPDATE users SET credits = credits + $1 WHERE id = $2',
        [amount, toId]
      );

      // Log transaction
      await client.query(
        'INSERT INTO credit_transfers (from_user_id, to_user_id, amount) VALUES ($1, $2, $3)',
        [fromId, toId, amount]
      );
    });
  }

  // Paginacion estilo keyset (mas eficiente que OFFSET)
  async paginateKeyset(cursor: string | null, limit: number = 20): Promise<{ users: User[]; nextCursor: string | null }> {
    const params: any[] = [limit];
    let whereClause = 'WHERE deleted_at IS NULL';

    if (cursor) {
      whereClause += ' AND created_at < $2';
      params.push(cursor);
    }

    const sql = `
      SELECT id, email, name, role, created_at
      FROM users
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $1
    `;

    const users = await this.db.query<User>(sql, params);

    const nextCursor = users.length === limit
      ? users[users.length - 1].created_at.toISOString()
      : null;

    return { users, nextCursor };
  }
}
```

### Principios SQL Puro en Nest.js:

```
1. SIEMPRE parametrizado: pool.query('SELECT...WHERE id = $1', [id])
2. NUNCA concatenacion: evita `SELECT * FROM ${table}` sin whitelist
3. Usa RETURNING: INSERT/UPDATE con RETURNING * evita SELECT extra
4. Pool de conexiones: usa pg Pool, no Client directo
5. Transacciones explicitas: BEGIN/COMMIT/ROLLBACK en operaciones multi-tabla
6. Stored procedures: encapsula logica compleja en la BD
7. Keyset pagination: OFFSET solo para datasets chicos (< 1000 paginas)
8. Prepared statements: para queries ejecutadas frecuentemente
```

---

## Authentication

### JWT Strategy (Passport)

```typescript
// jwt.strategy.ts
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    // This payload gets attached to request.user
    return { sub: payload.sub, email: payload.email, roles: payload.roles };
  }
}

// auth.module.ts
@Module({
  imports: [
    UsersModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET'),
        signOptions: { expiresIn: config.get('JWT_EXPIRES_IN', '15m') },
      }),
    }),
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}

// auth.service.ts
@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    @Inject('REFRESH_TOKEN_REPO') private readonly refreshRepo: Repository<RefreshToken>,
  ) {}

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.usersService.validateCredentials(dto.email, dto.password);
    
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      roles: user.roles,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload),
      this.generateRefreshToken(user.id),
    ]);

    return {
      accessToken,
      refreshToken,
      expiresIn: 900,
      user: UserDto.fromEntity(user),
    };
  }

  async refreshTokens(token: string): Promise<AuthResponse> {
    const stored = await this.refreshRepo.findOne({
      where: { token },
      relations: ['user'],
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Rotate refresh token
    await this.refreshRepo.remove(stored);
    return this.login({ email: stored.user.email, password: '' });
  }

  private async generateRefreshToken(userId: string): Promise<string> {
    const token = crypto.randomBytes(64).toString('hex');
    const entity = this.refreshRepo.create({
      token,
      userId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });
    await this.refreshRepo.save(entity);
    return token;
  }
}
```

---

## Testing

### Unit Test (Service)

```typescript
describe('UsersService', () => {
  let service: UsersService;
  let repo: Repository<User>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            findAndCount: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: CacheService,
          useValue: { get: jest.fn(), set: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(UsersService);
    repo = module.get(getRepositoryToken(User));
  });

  it('returns user from cache when available', async () => {
    const cached = { id: '1', email: 'test@test.com' };
    jest.spyOn(module.get(CacheService), 'get').mockResolvedValue(JSON.stringify(cached));

    const result = await service.findOne('1');

    expect(result).toEqual(cached);
    expect(repo.findOne).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when user missing', async () => {
    jest.spyOn(module.get(CacheService), 'get').mockResolvedValue(null);
    jest.spyOn(repo, 'findOne').mockResolvedValue(null);

    await expect(service.findOne('999')).rejects.toThrow(NotFoundException);
  });
});
```

### E2E Test (Controller)

```typescript
describe('UsersController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = module.get(PrismaService);
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "user" CASCADE');
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /users creates a user', async () => {
    const res = await request(app.getHttpServer())
      .post('/users')
      .send({ email: 'new@test.com', name: 'New User', password: 'password123' })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe('new@test.com');
    expect(res.body.data).not.toHaveProperty('password');  // DTO excludes it
  });

  it('POST /users rejects duplicate email', async () => {
    await request(app.getHttpServer())
      .post('/users')
      .send({ email: 'new@test.com', name: 'Dup', password: 'password123' })
      .expect(409);
  });

  it('GET /users requires authentication', async () => {
    await request(app.getHttpServer())
      .get('/users')
      .expect(401);
  });
});
```

---

## Project Structure

```
src/
  common/                     # Shared across all modules
    decorators/               # @Roles(), @CurrentUser(), @Public()
      current-user.decorator.ts
      roles.decorator.ts
      public.decorator.ts
    guards/                   # Custom guards
      jwt-auth.guard.ts
      roles.guard.ts
    interceptors/             # Global interceptors
      transform.interceptor.ts
      logging.interceptor.ts
    filters/                  # Global exception filters
      http-exception.filter.ts
    pipes/                    # Custom pipes
      parse-email.pipe.ts
      trim.pipe.ts
    dto/                      # Shared DTOs
      pagination.dto.ts
      response.dto.ts
    interfaces/               # Shared interfaces
      request-with-user.interface.ts
  config/                     # Configuration
    app.config.ts
    database.config.ts
    jwt.config.ts
    cache.config.ts
  modules/                    # Feature modules
    auth/
      auth.module.ts
      auth.controller.ts
      auth.service.ts
      strategies/
        jwt.strategy.ts
      dtos/
        login.dto.ts
        register.dto.ts
    users/
      users.module.ts
      users.controller.ts
      users.service.ts
      entities/
        user.entity.ts
        profile.entity.ts
      dtos/
        create-user.dto.ts
        update-user.dto.ts
        user-response.dto.ts
    health/
      health.module.ts
      health.controller.ts
  database/
    migrations/
    seeds/
    connection.ts
  main.ts
  app.module.ts
```

---

## Common Pitfalls

### Scope Injection (Avoid Request Scope by Default)
```typescript
// BAD: Makes everything request-scoped = slower
@Injectable({ scope: Scope.REQUEST })
export class UsersService {}

// GOOD: Default singleton unless you really need request scope
@Injectable()
export class UsersService {}
```

### Circular Dependencies
```typescript
// BAD: Module A imports B, B imports A
// Fix: Use forwardRef
@Module({
  imports: [forwardRef(() => ModuleB)],
})
export class ModuleA {}

@Module({
  imports: [forwardRef(() => ModuleA)],
})
export class ModuleB {}
// Better fix: Extract shared logic to a third module (C)
```

### Large Modules (God Modules)
```typescript
// BAD: One module with 20 controllers and 30 services
// GOOD: Split into feature modules
@Module({ imports: [UsersModule, PostsModule, CommentsModule] })
export class AppModule {}
```

### Ignoring Async Providers
```typescript
// BAD: Direct synchronous call in DI that should be async
{ provide: 'CONNECTION', useValue: createConnection() } // blocks startup

// GOOD: Use async factory
{
  provide: 'CONNECTION',
  useFactory: async () => await createConnection(),
}
```

### Forgetting to Export
```typescript
// BAD: UsersModule provides UsersService but doesn't export it
// Module B importing UsersModule can't inject UsersService
@Module({
  providers: [UsersService],
})
export class UsersModule {}

// GOOD: Export what other modules need
@Module({
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
```

### No Input Validation on Route Params
```typescript
// BAD: id can be anything
@Get(':id')
findOne(@Param('id') id: string) {}

// GOOD: Validate with pipes
@Get(':id')
findOne(@Param('id', ParseUUIDPipe) id: string) {}

// OR: Custom pipe for specific validation
@Get('by-slug/:slug')
findBySlug(@Param('slug', ParseSlugPipe) slug: string) {}
```

### Not Using async/await Properly
```typescript
// BAD: Unhandled promise - error is silently swallowed
@Post()
create(@Body() dto: CreateDto) {
  this.emailService.sendWelcome(dto.email); // fire and forget without catch
}

// GOOD: Catch errors or use Promise.allSettled
@Post()
async create(@Body() dto: CreateDto) {
  this.emailService.sendWelcome(dto.email).catch(err => {
    this.logger.error('Welcome email failed', err);
  });
}
```
