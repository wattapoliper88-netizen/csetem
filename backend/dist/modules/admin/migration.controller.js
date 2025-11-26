"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var MigrationController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MigrationController = void 0;
const common_1 = require("@nestjs/common");
const child_process_1 = require("child_process");
const path = require("path");
let MigrationController = MigrationController_1 = class MigrationController {
    constructor() {
        this.logger = new common_1.Logger(MigrationController_1.name);
    }
    async runMigration(req, res) {
        var _a, _b;
        const secret = req.header('x-migration-secret');
        const expected = process.env.MIGRATION_ADMIN_SECRET;
        if (!expected || !secret || secret !== expected) {
            return res.status(common_1.HttpStatus.FORBIDDEN).json({ error: 'Forbidden' });
        }
        try {
            const projectRoot = path.resolve(__dirname, '../../../..');
            const scriptPath = path.join(projectRoot, 'dist', 'scripts', 'migrate-avatars-to-firebase.js');
            this.logger.log(`Spawning migration: node ${scriptPath}`);
            const child = (0, child_process_1.exec)(`node "${scriptPath}"`, { env: process.env }, (error, stdout, stderr) => {
                if (error) {
                    this.logger.error('Migration failed', error);
                }
                if (stdout)
                    this.logger.log(stdout);
                if (stderr)
                    this.logger.error(stderr);
            });
            (_a = child.stdout) === null || _a === void 0 ? void 0 : _a.pipe(res.write.bind(res));
            (_b = child.stderr) === null || _b === void 0 ? void 0 : _b.pipe(res.write.bind(res));
            return res.status(common_1.HttpStatus.ACCEPTED).json({ status: 'Migration started' });
        }
        catch (err) {
            this.logger.error('Failed to start migration', err);
            return res.status(common_1.HttpStatus.INTERNAL_SERVER_ERROR).json({ error: 'Failed to start migration' });
        }
    }
};
exports.MigrationController = MigrationController;
__decorate([
    (0, common_1.Post)('migrate'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], MigrationController.prototype, "runMigration", null);
exports.MigrationController = MigrationController = MigrationController_1 = __decorate([
    (0, common_1.Controller)('admin')
], MigrationController);
//# sourceMappingURL=migration.controller.js.map