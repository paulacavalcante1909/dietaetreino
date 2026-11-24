<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Alimentos: user_id null = base global (TACO / Open Food Facts); preenchido = cadastro da usuária.
        // Valores nutricionais referem-se a `base_qty` `base_unit` (normalmente 100 g).
        Schema::create('foods', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('source', 10); // taco | off | manual
            $table->string('external_id', 40)->nullable();
            $table->string('ean', 20)->nullable()->index();
            $table->string('name', 190);
            $table->string('brand', 120)->nullable();
            $table->string('category', 120)->nullable();
            $table->string('search_name', 320)->index(); // minúsculo, sem acento: nome + marca
            $table->decimal('base_qty', 8, 2)->default(100);
            $table->string('base_unit', 4)->default('g'); // g | ml
            $table->decimal('kcal', 8, 2);
            $table->decimal('carbs', 8, 2);
            $table->decimal('protein', 8, 2);
            $table->decimal('fat', 8, 2);
            $table->decimal('sodium', 9, 2); // mg
            $table->decimal('fiber', 8, 2)->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['source', 'external_id']);
        });

        Schema::create('food_portions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('food_id')->constrained('foods')->cascadeOnDelete();
            $table->string('label', 60); // ex.: "1 unidade", "1 fatia"
            $table->decimal('qty', 8, 2); // em base_unit (g ou ml)
        });

        Schema::create('favorites', function (Blueprint $table) {
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('food_id')->constrained('foods')->cascadeOnDelete();
            $table->timestamp('created_at')->useCurrent();
            $table->primary(['user_id', 'food_id']);
        });

        Schema::create('meals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name', 60);
            $table->unsignedSmallInteger('position')->default(0);
            $table->boolean('active')->default(true);
            $table->timestamps();
        });

        // Registro do diário com SNAPSHOT dos valores: editar/excluir o alimento não altera o histórico.
        Schema::create('diary_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->date('date');
            $table->foreignId('meal_id')->constrained()->cascadeOnDelete();
            $table->foreignId('food_id')->nullable()->constrained('foods')->nullOnDelete();
            $table->foreignId('portion_id')->nullable()->constrained('food_portions')->nullOnDelete();
            $table->string('name', 190);
            $table->string('brand', 120)->nullable();
            $table->decimal('quantity', 8, 2);   // nº de porções ou g/ml
            $table->string('unit_label', 80);    // "g", "ml", "1 fatia (25 g)"
            $table->decimal('amount', 9, 2);     // total em g/ml
            $table->string('base_unit', 4)->default('g');
            $table->decimal('kcal', 8, 2);
            $table->decimal('carbs', 8, 2);
            $table->decimal('protein', 8, 2);
            $table->decimal('fat', 8, 2);
            $table->decimal('sodium', 9, 2);
            $table->timestamps();

            $table->index(['user_id', 'date']);
        });

        Schema::create('water_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->date('date');
            $table->unsignedSmallInteger('ml');
            $table->timestamps();

            $table->index(['user_id', 'date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('water_logs');
        Schema::dropIfExists('diary_entries');
        Schema::dropIfExists('meals');
        Schema::dropIfExists('favorites');
        Schema::dropIfExists('food_portions');
        Schema::dropIfExists('foods');
    }
};
