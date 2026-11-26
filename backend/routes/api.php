<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CheckinController;
use App\Http\Controllers\Api\ExerciseController;
use App\Http\Controllers\Api\WorkoutController;
use App\Http\Controllers\Api\WorkoutSessionController;
use App\Http\Controllers\Api\DayController;
use App\Http\Controllers\Api\EntryController;
use App\Http\Controllers\Api\FoodController;
use App\Http\Controllers\Api\GoalController;
use App\Http\Controllers\Api\MealController;
use App\Http\Controllers\Api\PasswordResetController;
use App\Http\Controllers\Api\StatsController;
use App\Http\Controllers\Api\RecipeController;
use App\Http\Controllers\Api\WaterController;
use App\Http\Controllers\Api\WeightController;
use Illuminate\Support\Facades\Route;

Route::middleware('throttle:10,1')->group(function () {
    Route::post('/auth/register', [AuthController::class, 'register']);
    Route::post('/auth/login', [AuthController::class, 'login']);
    Route::post('/auth/forgot', [PasswordResetController::class, 'forgot']);
    Route::post('/auth/reset', [PasswordResetController::class, 'reset']);
});

// Foto do check-in: acesso só por link temporário assinado (a tag <img> não envia o token)
Route::get('/checkins/{checkin}/photo', [CheckinController::class, 'photo'])
    ->middleware('signed:relative')->name('checkins.photo');

Route::middleware('auth:sanctum')->group(function () {
    // Conta
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::put('/me', [AuthController::class, 'updateProfile']);
    Route::put('/me/password', [AuthController::class, 'updatePassword']);
    Route::put('/me/preferences', [AuthController::class, 'updatePreferences']);
    Route::delete('/me', [AuthController::class, 'destroy']);

    // Metas
    Route::get('/goals', [GoalController::class, 'show']);
    Route::post('/goals', [GoalController::class, 'store']);

    // Painel do dia
    Route::get('/day/{date}', [DayController::class, 'show']);

    // Estatísticas
    Route::get('/calendar', [StatsController::class, 'calendar']);
    Route::get('/stats/week', [StatsController::class, 'week']);
    Route::get('/stats/workouts', [StatsController::class, 'workouts']);
    Route::get('/stats/loads', [StatsController::class, 'loads']);

    // Refeições
    Route::get('/meals', [MealController::class, 'index']);
    Route::post('/meals', [MealController::class, 'store']);
    Route::put('/meals/order', [MealController::class, 'reorder']);
    Route::put('/meals/{meal}', [MealController::class, 'update']);
    Route::delete('/meals/{meal}', [MealController::class, 'destroy']);

    // Alimentos
    Route::get('/foods/search', [FoodController::class, 'search']);
    Route::get('/foods/search-off', [FoodController::class, 'searchOff'])->middleware('throttle:20,1');
    Route::get('/foods/barcode/{ean}', [FoodController::class, 'barcode'])->middleware('throttle:60,1');
    Route::get('/foods/recent', [FoodController::class, 'recent']);
    Route::get('/foods/favorites', [FoodController::class, 'favorites']);
    Route::get('/foods/mine', [FoodController::class, 'mine']);
    Route::post('/foods', [FoodController::class, 'store']);
    Route::get('/foods/{food}', [FoodController::class, 'show']);
    Route::put('/foods/{food}', [FoodController::class, 'update']);
    Route::delete('/foods/{food}', [FoodController::class, 'destroy']);
    Route::post('/foods/{food}/favorite', [FoodController::class, 'favorite']);
    Route::delete('/foods/{food}/favorite', [FoodController::class, 'unfavorite']);

    // Receitas
    Route::get('/recipes', [RecipeController::class, 'index']);
    Route::post('/recipes', [RecipeController::class, 'store']);
    Route::get('/recipes/{recipe}', [RecipeController::class, 'show']);
    Route::put('/recipes/{recipe}', [RecipeController::class, 'update']);
    Route::delete('/recipes/{recipe}', [RecipeController::class, 'destroy']);
    Route::post('/recipes/{recipe}/duplicate', [RecipeController::class, 'duplicate']);

    // Diário
    Route::post('/entries', [EntryController::class, 'store']);
    Route::post('/entries/copy', [EntryController::class, 'copy']);
    Route::put('/entries/{entry}', [EntryController::class, 'update']);
    Route::delete('/entries/{entry}', [EntryController::class, 'destroy']);

    // Treino
    Route::get('/exercises', [ExerciseController::class, 'index']);
    Route::post('/exercises', [ExerciseController::class, 'store']);
    Route::delete('/exercises/{exercise}', [ExerciseController::class, 'destroy']);
    Route::get('/workouts', [WorkoutController::class, 'index']);
    Route::post('/workouts', [WorkoutController::class, 'store']);
    Route::put('/workouts/order', [WorkoutController::class, 'reorder']);
    Route::get('/workouts/{workout}', [WorkoutController::class, 'show']);
    Route::put('/workouts/{workout}', [WorkoutController::class, 'update']);
    Route::delete('/workouts/{workout}', [WorkoutController::class, 'destroy']);
    Route::post('/workouts/{workout}/duplicate', [WorkoutController::class, 'duplicate']);
    Route::post('/workout-sessions', [WorkoutSessionController::class, 'store']);
    Route::get('/workout-sessions/{session}', [WorkoutSessionController::class, 'show']);
    Route::get('/checkins', [CheckinController::class, 'index']);
    Route::post('/checkins', [CheckinController::class, 'store'])->middleware('throttle:20,1');
    Route::delete('/checkins/{checkin}', [CheckinController::class, 'destroy']);

    // Peso corporal
    Route::get('/weights', [WeightController::class, 'index']);
    Route::post('/weights', [WeightController::class, 'store']);
    Route::put('/weights/{weight}', [WeightController::class, 'update']);
    Route::delete('/weights/{weight}', [WeightController::class, 'destroy']);

    // Água
    Route::post('/water', [WaterController::class, 'store']);
    Route::delete('/water/{water}', [WaterController::class, 'destroy']);
});
