<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Fibras no diário e nas metas; dados do perfil para o déficit calórico (TMB × fator de atividade).
     */
    public function up(): void
    {
        Schema::table('diary_entries', function (Blueprint $table) {
            $table->decimal('fiber', 8, 2)->default(0)->after('sodium'); // g
        });
        Schema::table('goals', function (Blueprint $table) {
            $table->unsignedSmallInteger('fiber_g')->default(25)->after('sodium_mg');
        });
        Schema::table('users', function (Blueprint $table) {
            $table->char('sex', 1)->nullable();               // 'f' | 'm' (fórmula de Mifflin-St Jeor)
            $table->date('birth_date')->nullable();
            $table->unsignedSmallInteger('height_cm')->nullable();
        });

        // Registros antigos feitos a partir de alimentos: calcula a fibra pelo alimento de origem
        // (subconsulta correlacionada: funciona no MySQL e no SQLite dos testes)
        DB::statement(<<<'SQL'
            UPDATE diary_entries
            SET fiber = COALESCE((
                SELECT ROUND(foods.fiber * diary_entries.amount / foods.base_qty, 1)
                FROM foods
                WHERE foods.id = diary_entries.food_id AND foods.fiber IS NOT NULL AND foods.base_qty > 0
            ), 0)
            WHERE food_id IS NOT NULL
        SQL);
    }

    public function down(): void
    {
        Schema::table('diary_entries', fn (Blueprint $t) => $t->dropColumn('fiber'));
        Schema::table('goals', fn (Blueprint $t) => $t->dropColumn('fiber_g'));
        Schema::table('users', fn (Blueprint $t) => $t->dropColumn(['sex', 'birth_date', 'height_cm']));
    }
};
