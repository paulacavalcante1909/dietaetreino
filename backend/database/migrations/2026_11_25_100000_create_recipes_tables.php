<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('recipes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name', 120);
            $table->decimal('servings', 6, 2)->default(1);
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('recipe_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('recipe_id')->constrained()->cascadeOnDelete();
            $table->foreignId('food_id')->constrained('foods'); // alimentos usam soft delete
            $table->foreignId('portion_id')->nullable()->constrained('food_portions')->nullOnDelete();
            $table->decimal('quantity', 8, 2);
            $table->unsignedSmallInteger('position')->default(0);
        });

        Schema::table('diary_entries', function (Blueprint $table) {
            $table->foreignId('recipe_id')->nullable()->after('food_id')->constrained('recipes')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('diary_entries', function (Blueprint $table) {
            $table->dropConstrainedForeignId('recipe_id');
        });
        Schema::dropIfExists('recipe_items');
        Schema::dropIfExists('recipes');
    }
};
