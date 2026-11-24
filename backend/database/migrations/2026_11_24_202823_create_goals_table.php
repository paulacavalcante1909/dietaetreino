<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('goals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            // Meta vale a partir desta data; dias anteriores usam a meta vigente na época.
            $table->date('valid_from');
            $table->unsignedInteger('kcal');
            $table->decimal('carbs_g', 7, 1);
            $table->decimal('protein_g', 7, 1);
            $table->decimal('fat_g', 7, 1);
            $table->unsignedInteger('sodium_mg');
            $table->unsignedInteger('water_ml');
            $table->timestamps();

            $table->unique(['user_id', 'valid_from']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('goals');
    }
};
