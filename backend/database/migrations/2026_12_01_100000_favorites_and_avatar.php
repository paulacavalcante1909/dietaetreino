<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Exercícios favoritos e foto de perfil.
     * (A distância do cardio fica dentro do JSON `exercises` do treino, sem coluna nova.)
     */
    public function up(): void
    {
        Schema::create('exercise_favorites', function (Blueprint $table) {
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('exercise_id')->constrained()->cascadeOnDelete();
            $table->timestamp('created_at')->nullable();
            $table->primary(['user_id', 'exercise_id']);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->string('avatar_path')->nullable()->after('height_cm');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('exercise_favorites');
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('avatar_path');
        });
    }
};
