<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Food;
use App\Models\Recipe;
use App\Models\User;
use App\Services\OpenFoodFacts;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class FoodController extends Controller
{
    private const LIST_COLUMNS = ['id', 'user_id', 'source', 'name', 'display_name', 'brand', 'base_qty', 'base_unit', 'kcal', 'carbs', 'protein', 'fat', 'sodium', 'fiber'];

    /**
     * Código de barras: 1) alimento da usuária com esse código, 2) cache global, 3) Open Food Facts.
     * 404 = não encontrado (o app oferece o cadastro manual com o código preenchido).
     */
    public function barcode(Request $request, string $ean, OpenFoodFacts $off): JsonResponse
    {
        abort_unless(preg_match('/^\d{8,14}$/', $ean), 422, 'Código de barras inválido.');
        $user = $request->user();

        $food = $user->foods()->where('ean', $ean)->latest('id')->first()
            ?? Food::whereNull('user_id')->where('ean', $ean)->first()
            ?? $off->findByBarcode($ean);

        if (! $food) {
            return response()->json(['message' => 'Produto não encontrado.', 'ean' => $ean], 404);
        }

        return response()->json(['food' => $this->detail($request, $food)]);
    }

    /** Busca por nome na Open Food Facts (produtos de marca). Só nome/marca; nutrientes vêm ao abrir. */
    public function searchOff(Request $request, OpenFoodFacts $off): JsonResponse
    {
        $q = trim((string) $request->query('q', ''));
        if (mb_strlen($q) < 3) {
            return response()->json(['products' => []]);
        }

        return response()->json(['products' => $off->search($q)]);
    }

    /** Busca por nome: ignora acentos; todas as palavras precisam aparecer. */
    public function search(Request $request): JsonResponse
    {
        $q = Food::normalize((string) $request->query('q', ''));
        $words = array_values(array_filter(explode(' ', $q), fn ($w) => mb_strlen($w) >= 2));
        // Radical simples: "cozido"/"cozida"/"cozidos" → "cozid"
        $words = array_map(fn ($w) => mb_strlen($w) >= 5 ? preg_replace('/(os|as|o|a|s)$/', '', $w) : $w, $words);
        if (! $words) {
            return response()->json(['foods' => []]);
        }

        $user = $request->user();
        $query = Food::visibleTo($user)->select(self::LIST_COLUMNS);
        foreach ($words as $w) {
            $query->where('search_name', 'like', '%'.$w.'%');
        }

        // Ranking: meus alimentos > começa com a busca > já usados > nome mais curto
        $usedIds = $user->entries()->whereNotNull('food_id')->distinct()->pluck('food_id');
        $foods = $query
            ->orderByRaw('user_id IS NULL')
            ->orderByRaw('search_name NOT LIKE ?', [$words[0].'%'])
            ->when($usedIds->isNotEmpty(), fn (Builder $b) => $b->orderByRaw('id NOT IN ('.$usedIds->implode(',').')'))
            ->orderByRaw('CHAR_LENGTH(name)')
            ->limit(40)
            ->get();

        return response()->json(['foods' => $this->markFavorites($user, $foods)]);
    }

    /** Últimos alimentos usados (sem repetir). */
    public function recent(Request $request): JsonResponse
    {
        $used = $request->user()->entries()
            ->whereNotNull('food_id')
            ->select('food_id', DB::raw('MAX(id) as last'))
            ->groupBy('food_id')
            ->orderByDesc('last')
            ->limit(30)
            ->pluck('last', 'food_id');
        $ids = $used->keys();

        // Última porção usada de cada alimento (para "adicionar de novo" com 1 toque)
        $last = $request->user()->entries()->whereIn('food_id', $ids)
            ->orderByDesc('id')->get(['food_id', 'quantity', 'portion_id', 'unit_label', 'kcal'])
            ->unique('food_id')->keyBy('food_id');

        $foods = Food::whereIn('id', $ids)->select(self::LIST_COLUMNS)->get()
            ->sortBy(fn ($f) => $ids->search($f->id))->values()
            ->map(fn ($f) => [...$f->toArray(), 'last' => $last->get($f->id)?->only('quantity', 'portion_id', 'unit_label', 'kcal'), 'used_rank' => (int) $used[$f->id]]);

        // Refeições prontas usadas recentemente (aparecem junto, na ordem de uso)
        $recipeUsed = $request->user()->entries()
            ->whereNotNull('recipe_id')
            ->select('recipe_id', DB::raw('MAX(id) as last'))
            ->groupBy('recipe_id')
            ->orderByDesc('last')
            ->limit(10)
            ->pluck('last', 'recipe_id');
        $recipes = Recipe::where('user_id', $request->user()->id)
            ->whereIn('id', $recipeUsed->keys())
            ->with('items.food', 'items.portion')
            ->get()
            ->map(fn (Recipe $r) => [
                ...$r->summary(),
                'used_rank' => (int) $recipeUsed[$r->id],
                // Porções da última vez (para o "+" de 1 toque)
                'last_quantity' => (float) $request->user()->entries()->whereKey($recipeUsed[$r->id])->value('quantity'),
            ])
            ->sortByDesc('used_rank')
            ->values();

        return response()->json(['foods' => $this->markFavorites($request->user(), $foods), 'recipes' => $recipes]);
    }

    public function favorites(Request $request): JsonResponse
    {
        $foods = $request->user()->favorites()->select(array_map(fn ($c) => "foods.$c", self::LIST_COLUMNS))
            ->orderByDesc('favorites.created_at')->get()->makeHidden('pivot')
            ->map(fn ($f) => [...$f->toArray(), 'favorite' => true]);

        return response()->json(['foods' => $foods]);
    }

    public function mine(Request $request): JsonResponse
    {
        $foods = $request->user()->foods()->select(self::LIST_COLUMNS)->orderBy('name')->get();

        return response()->json(['foods' => $this->markFavorites($request->user(), $foods)]);
    }

    /**
     * Marca os favoritos da usuária (estrela na lista).
     *
     * @param  Collection<int, Food|array<string, mixed>>  $foods
     * @return list<array<string, mixed>>
     */
    private function markFavorites(User $user, Collection $foods): array
    {
        $favorites = $user->favorites()->pluck('foods.id')->flip();

        return $foods->map(function ($f) use ($favorites) {
            $row = $f instanceof Food ? $f->toArray() : $f;

            return [...$row, 'favorite' => isset($favorites[$row['id']])];
        })->values()->all();
    }

    public function show(Request $request, Food $food): JsonResponse
    {
        $this->authorizeView($request, $food);

        return response()->json(['food' => $this->detail($request, $food)]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);
        $food = $request->user()->foods()->create([...$data, 'source' => 'manual']);
        $this->syncPortions($food, $data['portions'] ?? []);

        return response()->json(['food' => $this->detail($request, $food)], 201);
    }

    public function update(Request $request, Food $food): JsonResponse
    {
        abort_unless($food->isOwnedBy($request->user()), 403, 'Você só pode editar alimentos que cadastrou.');
        $data = $this->validated($request);
        $food->update($data);
        $this->syncPortions($food, $data['portions'] ?? []);

        return response()->json(['food' => $this->detail($request, $food)]);
    }

    /** Soft delete: o histórico do diário guarda snapshot e continua intacto. */
    public function destroy(Request $request, Food $food): JsonResponse
    {
        abort_unless($food->isOwnedBy($request->user()), 403, 'Você só pode excluir alimentos que cadastrou.');
        $food->delete();

        return response()->json(['ok' => true]);
    }

    public function favorite(Request $request, Food $food): JsonResponse
    {
        $this->authorizeView($request, $food);
        $request->user()->favorites()->syncWithoutDetaching([$food->id]);

        return response()->json(['favorite' => true]);
    }

    public function unfavorite(Request $request, Food $food): JsonResponse
    {
        $request->user()->favorites()->detach($food->id);

        return response()->json(['favorite' => false]);
    }

    private function authorizeView(Request $request, Food $food): void
    {
        abort_if($food->user_id !== null && ! $food->isOwnedBy($request->user()), 404);
    }

    private function detail(Request $request, Food $food): array
    {
        $food->load('portions');

        return [
            ...$food->toArray(),
            'is_mine' => $food->isOwnedBy($request->user()),
            'is_favorite' => $request->user()->favorites()->where('food_id', $food->id)->exists(),
        ];
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:190'],
            'brand' => ['nullable', 'string', 'max:120'],
            'ean' => ['nullable', 'string', 'regex:/^\d{8,14}$/'],
            'base_qty' => ['required', 'numeric', 'gt:0', 'max:5000'],
            'base_unit' => ['required', 'in:g,ml'],
            'kcal' => ['required', 'numeric', 'min:0', 'max:9000'],
            'carbs' => ['required', 'numeric', 'min:0', 'max:5000'],
            'protein' => ['required', 'numeric', 'min:0', 'max:5000'],
            'fat' => ['required', 'numeric', 'min:0', 'max:5000'],
            'sodium' => ['required', 'numeric', 'min:0', 'max:100000'],
            'fiber' => ['nullable', 'numeric', 'min:0', 'max:5000'],
            'portions' => ['nullable', 'array', 'max:10'],
            'portions.*.label' => ['required', 'string', 'max:60'],
            'portions.*.qty' => ['required', 'numeric', 'gt:0', 'max:5000'],
        ], ['ean.regex' => 'O código de barras deve ter de 8 a 14 dígitos.']);
    }

    private function syncPortions(Food $food, array $portions): void
    {
        $food->portions()->delete();
        foreach ($portions as $p) {
            $food->portions()->create(['label' => $p['label'], 'qty' => $p['qty']]);
        }
    }
}
