<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Treino executado (a partir de "Iniciar treino"): tempo e exercícios feitos.
        // Snapshot: editar/excluir a ficha não altera o que foi feito.
        Schema::create('workout_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('workout_id')->nullable()->constrained()->nullOnDelete();
            $table->string('workout_name', 80);
            $table->date('date');
            $table->timestamp('started_at');
            $table->timestamp('finished_at');
            $table->unsignedInteger('duration_seconds');
            $table->json('exercises'); // [{name, muscle_group, image, sets, reps, sets_done, done}]
            $table->timestamps();

            $table->index(['user_id', 'date']);
        });

        Schema::table('checkins', function (Blueprint $table) {
            $table->foreignId('session_id')->nullable()->after('workout_id')->constrained('workout_sessions')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('checkins', function (Blueprint $table) {
            $table->dropConstrainedForeignId('session_id');
        });
        Schema::dropIfExists('workout_sessions');
    }
};
