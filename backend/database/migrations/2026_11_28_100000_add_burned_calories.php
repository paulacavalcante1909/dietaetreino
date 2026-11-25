<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Estimativa de gasto calórico do treino (MET × peso × horas), calculada ao salvar
        Schema::table('workout_sessions', function (Blueprint $table) {
            $table->unsignedSmallInteger('kcal_burned')->nullable()->after('duration_seconds');
            $table->decimal('weight_kg', 5, 1)->nullable()->after('kcal_burned'); // peso usado no cálculo
            $table->boolean('weight_estimated')->default(false)->after('weight_kg'); // true = sem peso registrado (65 kg)
        });

        // Preferência: somar o gasto do treino à meta calórica do dia (desligado por padrão)
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('add_burned_to_goal')->default(false)->after('terms_accepted_at');
        });
    }

    public function down(): void
    {
        Schema::table('workout_sessions', function (Blueprint $table) {
            $table->dropColumn(['kcal_burned', 'weight_kg', 'weight_estimated']);
        });
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('add_burned_to_goal');
        });
    }
};
