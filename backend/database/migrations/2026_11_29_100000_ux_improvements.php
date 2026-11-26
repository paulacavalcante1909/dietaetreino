<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Nome amigável para exibição (ex.: TACO "Ovo, de galinha, inteiro, cozido/10minutos" → "Ovo inteiro cozido")
        Schema::table('foods', function (Blueprint $table) {
            $table->string('display_name', 190)->nullable()->after('name');
        });

        // Check-in sem foto passa a ser permitido
        Schema::table('checkins', function (Blueprint $table) {
            $table->string('photo_path', 200)->nullable()->change();
        });

        // Meta de frequência semanal de treinos
        Schema::table('users', function (Blueprint $table) {
            $table->unsignedTinyInteger('weekly_workout_goal')->default(3)->after('add_burned_to_goal');
        });
    }

    public function down(): void
    {
        Schema::table('foods', fn (Blueprint $t) => $t->dropColumn('display_name'));
        Schema::table('users', fn (Blueprint $t) => $t->dropColumn('weekly_workout_goal'));
        Schema::table('checkins', fn (Blueprint $t) => $t->string('photo_path', 200)->nullable(false)->change());
    }
};
