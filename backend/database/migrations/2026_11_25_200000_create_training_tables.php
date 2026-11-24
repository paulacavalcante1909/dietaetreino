<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Biblioteca: user_id null = padrão do app; preenchido = exercício personalizado
        Schema::create('exercises', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('source_id', 120)->nullable()->unique();
            $table->string('name', 120);
            $table->string('search_name', 160)->index();
            $table->string('muscle_group', 20)->index();
            $table->string('image', 160)->nullable(); // pasta com 0.webp e 1.webp
            $table->timestamps();
        });

        // Fichas: Treino A, B, C…
        Schema::create('workouts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name', 80);
            $table->unsignedSmallInteger('position')->default(0);
            $table->timestamps();
        });

        Schema::create('workout_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workout_id')->constrained()->cascadeOnDelete();
            $table->foreignId('exercise_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('position')->default(0);
            $table->unsignedTinyInteger('sets');
            $table->string('reps', 20); // "10", "8-12", "até a falha", "30 s"
            $table->string('notes', 200)->nullable();
        });

        // Check-in do treino com foto do dia (privado)
        Schema::create('checkins', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('workout_id')->nullable()->constrained()->nullOnDelete();
            $table->string('workout_name', 80); // snapshot: renomear/excluir o treino não muda o histórico
            $table->date('date');
            $table->string('photo_path', 200);
            $table->string('note', 280)->nullable();
            $table->timestamps();

            $table->index(['user_id', 'date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('checkins');
        Schema::dropIfExists('workout_items');
        Schema::dropIfExists('workouts');
        Schema::dropIfExists('exercises');
    }
};
