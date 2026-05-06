# NestJS Packages & Deep Patterns

Librerias y patrones avanzados para produccion.

## Passport + JWT Avanzado

```typescript
// jwt.strategy.ts - Extraer token de cookie o header
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req) => req?.cookies?.access_token,           // cookie
        ExtractJwt.fromAuthHeaderAsBearerToken(),      // header: Bearer xxx
      ]),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_SECRET'),
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: JwtPayload) {
    // Validacion extra: fingerprint, user agent, ip
    const clientFingerprint = req.headers['x-fingerprint'] as string;
    if (clientFingerprint && payload.fingerprint !== clientFingerprint) {
      throw new UnauthorizedException('Token fingerprint mismatch');
    }
    return payload;
  }
}

// roles.guard.ts - Guard con metadata de reflector
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>('roles', [
      context.getHandler(), context.getClass(),
    ]);
    if (!required) return true;

    const { user } = context.switchToHttp().getRequest();
    return required.some(role => user.roles?.includes(role));
  }
}

// Decorator combinado
export const Auth = (...roles: Role[]) => applyDecorators(
  SetMetadata('roles', roles),
  UseGuards(JwtAuthGuard, RolesGuard),
  ApiBearerAuth(),
  ApiUnauthorizedResponse({ description: 'Unauthorized' }),
);

// Uso
@Controller('admin')
@Auth(Role.ADMIN)
export class AdminController {}
```

## OpenAPI / Swagger Avanzado

```typescript
// main.ts - Configuracion Swagger
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

const config = new DocumentBuilder()
  .setTitle('API Docs')
  .setVersion('1.0')
  .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'JWT')
  .addApiKey({ type: 'apiKey', name: 'x-api-key', in: 'header' }, 'api-key')
  .addServer('http://localhost:3000', 'Local')
  .addServer('https://api.example.com', 'Production')
  .build();

const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup('api/docs', app, document, {
  swaggerOptions: {
    persistAuthorization: true,
    filter: true,
    displayRequestDuration: true,
    defaultModelsExpandDepth: -1, // oculta schemas por defecto
  },
  customSiteTitle: 'API Reference',
  customCss: '.swagger-ui .topbar { display: none }',
  customfavIcon: '/favicon.png',
});

// DTO anotado para Swagger
export class CreateUserDto {
  @ApiProperty({ example: 'test@test.com', description: 'User email' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'John', minLength: 2, maxLength: 100 })
  @IsString()
  name: string;

  @ApiProperty({ example: 'Str0ngP@ss!', minLength: 8, writeOnly: true })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ enum: UserRole, default: UserRole.USER })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}

// Response DTO
export class UserResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'email' })
  email: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ enum: UserRole })
  role: UserRole;

  @ApiProperty()
  createdAt: Date;

  static fromEntity(user: User): UserResponseDto {
    const { passwordHash, refreshTokens, ...safe } = user;
    return safe;
  }
}

// Controller con decoradores Swagger
@Controller('users')
@ApiTags('Users')
@ApiBearerAuth('JWT')
export class UsersController {
  @Get()
  @ApiOperation({ summary: 'List users', operationId: 'listUsers' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiResponse({ status: 200, type: PaginatedResponseDto })
  async findAll() {}
}
```

## Bull Queue (Jobs asincronos)

```typescript
// email.processor.ts
import { Processor, Process, OnQueueCompleted, OnQueueFailed } from '@nestjs/bull';
import { Job } from 'bull';

@Processor('email')
export class EmailProcessor {
  private readonly logger = new Logger(EmailProcessor.name);

  @Process('welcome')
  async handleWelcomeEmail(job: Job<{ userId: string; email: string }>) {
    this.logger.log(`Processing welcome email for ${job.data.email}`);
    // Enviar email...
    await new Promise(resolve => setTimeout(resolve, 2000));
    this.logger.log(`Welcome email sent to ${job.data.email}`);
  }

  @Process('resetPassword')
  async handleResetPassword(job: Job<{ email: string; token: string }>) {
    // Enviar email de reset
  }

  @OnQueueCompleted()
  onCompleted(job: Job) {
    this.logger.log(`Job ${job.id} completed`);
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error) {
    this.logger.error(`Job ${job.id} failed: ${error.message}`);
  }
}

// Enviar job desde un servicio
@Injectable()
export class AuthService {
  constructor(@InjectQueue('email') private emailQueue: Queue) {}

  async register(dto: RegisterDto) {
    const user = await this.createUser(dto);

    // Enviar email de bienvenida en background (no bloquea)
    await this.emailQueue.add('welcome', {
      userId: user.id,
      email: user.email,
    }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: true,
      removeOnFail: 50,
    });

    return user;
  }
}

// email.module.ts
@Module({
  imports: [
    BullModule.registerQueue({ name: 'email' }),
  ],
  providers: [EmailProcessor],
})
export class EmailModule {}

// app.module.ts
BullModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    redis: {
      host: config.get('REDIS_HOST', 'localhost'),
      port: config.get('REDIS_PORT', 6379),
      password: config.get('REDIS_PASS'),
    },
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 500,
    },
  }),
}),
```

## Caching (Cache Manager)

```typescript
// Cache interceptor a nivel de endpoint
@Get(':id')
@UseInterceptors(CacheInterceptor)
@CacheTTL(300) // 5 minutos
@CacheKey('user-detail')
async findOne(@Param('id') id: string) {
  return this.usersService.findOne(id);
}

// Cache programatico
@Injectable()
export class ProductService {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly db: DatabaseService,
  ) {}

  async findOne(id: string): Promise<Product> {
    const cacheKey = `product:${id}`;
    const cached = await this.cacheManager.get<Product>(cacheKey);
    if (cached) return cached;

    const product = await this.db.queryOne<Product>(
      'SELECT * FROM products WHERE id = $1', [id]
    );

    if (product) {
      await this.cacheManager.set(cacheKey, product, 300_000); // 5 min ttl
    }

    return product;
  }

  async invalidateCache(id: string): Promise<void> {
    await this.cacheManager.del(`product:${id}`);
    // Invalidar listas tambien
    await this.cacheManager.del('products:list');
  }
}
```

## Logging Avanzado (Pino / structured)

```typescript
// logger.module.ts
import { LoggerModule } from 'nestjs-pino';

@Module({
  imports: [
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          level: config.get('LOG_LEVEL', 'info'),
          transport: config.get('NODE_ENV') !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true } }
            : undefined,
          serializers: {
            req: (req) => ({
              method: req.method,
              url: req.url,
              query: req.query,
              params: req.params,
              // NUNCA loguear: headers.authorization, headers.cookie
            }),
            res: (res) => ({ statusCode: res.statusCode }),
          },
          redact: {
            paths: ['req.headers.authorization', 'req.headers.cookie', 'req.body.password', 'req.body.passwordHash'],
            censor: '[REDACTED]',
          },
          customProps: (req) => ({
            requestId: req.id,
            userId: (req as any).user?.sub,
          }),
        },
      }),
    }),
  ],
})
export class LoggingModule {}

// Uso en servicios
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  async create(dto: CreateUserDto) {
    this.logger.log({ email: dto.email, action: 'create_user' }, 'Creating user');
    // ...
  }
}
```

## Configuration Validation

```typescript
// config/validation.ts
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().int().default(6379),
  CORS_ORIGINS: z.string().transform(s => s.split(',').map(o => o.trim())),
  RATE_LIMIT_TTL: z.coerce.number().default(60000),
  RATE_LIMIT_MAX: z.coerce.number().default(30),
  SMTP_HOST: z.string().optional(),
  SMTP_PASS: z.string().optional(),
});

export function validate(config: Record<string, unknown>) {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    console.error('Invalid environment variables:', result.error.format());
    process.exit(1);
  }
  return result.data;
}

export type EnvConfig = z.infer<typeof envSchema>;

// main.ts
const app = await NestFactory.create(AppModule);
const env = app.get(ConfigService) as ConfigService<EnvConfig>;
```

## Performance Patterns

### Compression
```typescript
// main.ts
import compression from 'compression';

app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
  level: 6, // balance speed vs size
}));
```

### Connection Pooling
```typescript
// database.service.ts
const pool = new Pool({
  max: 20,                     // maximo de conexiones
  min: 2,                      // minimo mantenido
  idleTimeoutMillis: 30000,    // cerrar idle tras 30s
  connectionTimeoutMillis: 5000,
  statement_timeout: 10000,    // cancelar query tras 10s
  query_timeout: 15000,        // timeout por query
});

// Health check del pool
setInterval(() => {
  const { totalCount, idleCount, waitingCount } = pool;
  this.logger.log({ totalCount, idleCount, waitingCount }, 'Pool stats');
}, 30000);
```

### Request Timeout + Circuit Breaker

```typescript
// timeout.interceptor.ts
@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  constructor(private readonly timeout = 10000) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      timeout(this.timeout),
      catchError(err => {
        if (err instanceof TimeoutError) {
          throw new RequestTimeoutException('Request timed out');
        }
        return throwError(() => err);
      }),
    );
  }
}

// circuit-breaker para llamadas a servicios externos
import * as CircuitBreaker from 'opossum';

@Injectable()
export class ExternalService {
  private breaker: CircuitBreaker;

  constructor() {
    this.breaker = new CircuitBreaker(this.callExternalApi.bind(this), {
      timeout: 5000,
      errorThresholdPercentage: 50,
      resetTimeout: 30000,
      rollingCountTimeout: 10000,
      rollingCountBuckets: 10,
    });

    this.breaker.on('open', () => this.logger.warn('Circuit breaker OPEN'));
    this.breaker.on('halfOpen', () => this.logger.warn('Circuit breaker HALF-OPEN'));
    this.breaker.on('close', () => this.logger.log('Circuit breaker CLOSED'));
  }

  async fetchData(id: string) {
    return this.breaker.fire(id);
  }
}
```

### Response Caching con ETag

```typescript
// etag.interceptor.ts
@Injectable()
export class ETagInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    return next.handle().pipe(
      map(data => {
        const body = JSON.stringify(data);
        const hash = crypto.createHash('md5').update(body).digest('hex');
        const etag = `"${hash}"`;

        // If-None-Match header comparison
        if (request.headers['if-none-match'] === etag) {
          response.status(304).send();
          return null;
        }

        response.setHeader('ETag', etag);
        response.setHeader('Cache-Control', 'private, max-age=60');
        return data;
      }),
    );
  }
}
```
